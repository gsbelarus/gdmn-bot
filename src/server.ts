import Koa from "koa";
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import Telegraf, { Extra, Markup, ContextMessageUpdate } from 'telegraf';
import { IAccountLink, DialogState, ICustomer, IEmployee, IAccDed, IPaySlip, IDialogStateGettingCurrency, NBRBCurrencies, NBRBRates } from "./types";
import { FileDB } from "./util/fileDB";
import { InlineKeyboardMarkup } from "telegraf/typings/telegram-types";
import { paySlipConciseDialog } from "./actions/paySlipConciseDialog";
import { paySlipCompareDialog } from "./actions/paySlipCompareDialog";
import { keyboardLogin, keyboardMenu, keyboardSettings } from "./util/keybord";
import { loginDialog } from "./actions/loginDialog";
import { getPaySlip } from "./actions/getPaySlip";
import { upload } from "./actions/upload";
import { currencyDialog } from "./actions/currencyDialog";

/**
 * Связь между ИД чата и человеком, сотрудником предприятия.
 */
export const accountLink = new FileDB<IAccountLink>(path.resolve(process.cwd(), 'data/accountlink.json'), {});
export const dialogStates = new FileDB<DialogState>(path.resolve(process.cwd(), 'data/dialogstates.json'), {});
export const customers = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'), {});
export const employeesByCustomer: { [customerId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};

/**
 * справочники начислений/удержаний для каждого клиента.
 * ключем объекта выступает РУИД записи из базы Гедымина.
 */
export const customerAccDeds: { [customerID: string]: FileDB<IAccDed> } = {};

/**
 * Расчетные листки для каждого клиента.
 * Ключем объекта выступает персональный номер из паспорта.
 */
export const paySlips: { [employeeId: string]: FileDB<IPaySlip> } = {};

let app = new Koa();
let router = new Router();

const config = {
  domain: 'gs.selfip.biz',
  https: {
    port: 8443,
    options: {
      key: fs.readFileSync(path.resolve(process.cwd(), 'cert/gsbot-key.pem'), 'utf8').toString(),
      cert: fs.readFileSync(path.resolve(process.cwd(), 'cert/gsbot-cert.pem'), 'utf8').toString(),
    },
  },
};

router.get('/load', (ctx, next) => {
  // ctx.router available
  load(ctx);
  next();
});

const load = (ctx: any) => {
  ctx.body = 'Hello World!';
}

router.get('/', (ctx, next) => {
  ctx.body = 'Hello World!';
  next();
});

router.post('/upload', (ctx, next) => {
  upload(ctx);
  next();
});

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

const serverCallback = app.callback();

http.createServer(serverCallback).listen(3000);
https.createServer(config.https.options, serverCallback).listen(config.https.port);

export const withMenu = async (ctx: ContextMessageUpdate, msg: string, menu?: Markup & InlineKeyboardMarkup, markdown?: boolean) => {
  if (!ctx.chat) {
    throw new Error('Invalid context');
  }

  const m = markdown
    ? await ctx.reply(msg, menu && { parse_mode: 'MarkdownV2', ...Extra.markup(menu) })
    : await ctx.reply(msg, menu && Extra.markup(menu));

  const chatId = ctx.chat.id.toString();
  const dialogState = dialogStates.read(chatId);

  if (dialogState) {
    if (dialogState.menuMessageId) {
      try {
        await bot.telegram.editMessageReplyMarkup(ctx.chat.id, dialogState.menuMessageId);
      }
      catch (e) {
        // TODO: если сообщение уже было удалено из чата, то
        // будет ошибка, которую мы подавляем.
        // В будущем надо ловить события удаления сообщения
        // и убирать его ИД из сохраненных данных
      }
    }

    if (menu) {
      dialogStates.merge(chatId, { menuMessageId: m.message_id });
    } else {
      dialogStates.merge(chatId, { menuMessageId: undefined });
    }
  }
};

if (typeof process.env.GDMN_BOT_TOKEN !== 'string') {
  throw new Error('GDMN_BOT_TOKEN env variable is not specified.');
}

const bot = new Telegraf(process.env.GDMN_BOT_TOKEN);

bot.use( (ctx, next) => {
  console.log(`Chat ${ctx.chat?.id}: ${ctx.updateType} ${ctx.message?.text !== undefined ? ('-- ' + ctx.message?.text) : ''}`);
  return next && next();
});

/**
 * При старте бота проверяем этот пользователь уже привязан
 * к учетной записи сотрудника предприятия или нет.
 *
 * Если нет, то предлагаем пройти регистрацию.
 *
 * Если да, то выводим меню с дальнейшими действиями.
 */
bot.start(
  ctx => {

    if (!ctx.chat) {
      withMenu(ctx, 'Error: Invalid chat Id');
    } else {
      const chatId = ctx.chat.id.toString();
      const link = accountLink.read(chatId);

      if (!link) {
        dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() });
        withMenu(ctx,
          'Приветствуем! Для получения информации о заработной плате необходимо зарегистрироваться в системе.',
          keyboardLogin);
      } else {
        dialogStates.merge(chatId, { type: 'LOGGED_IN', lastUpdated: new Date().getTime() });
        withMenu(ctx,
          'Здраствуйте! Вы зарегистрированы в системе. Выберите одно из предложенных действий.',
          keyboardMenu);
      }
    }
  }
);

bot.help( ctx => withMenu(ctx, 'Help message') );

bot.on('message', async (ctx) => {
  if (ctx.chat) {
    const chatId = ctx.chat.id.toString();
    const dialogState = dialogStates.read(chatId);

    if (dialogState?.type === 'LOGGING_IN') {
      loginDialog(ctx);
    } else if (dialogState?.type === 'GETTING_CURRENCY' || dialogState?.type === 'GETTING_SETTINGS') {
      withMenu(ctx,
        `
        🤔 Ваша команда непонятна.

        Выберите одно из предложенных действий.
        `, keyboardMenu);
    }
    else if (dialogState?.type === 'LOGGED_IN') {
      if (ctx.message?.text === 'организации') {
        ctx.reply(Object.values(customers).map( c => c.name).join(', '));
        ctx.reply(ctx.chat.id.toString());
        ctx.reply(ctx.from!.id.toString());
        ctx.reply(ctx.from!.username!);
      } else {
        withMenu(ctx,
`
🤔 Ваша команда непонятна.

Выберите одно из предложенных действий.
`, keyboardMenu);
      }
    }
    else {
      withMenu(ctx,
        'Для получения информации о заработной плате необходимо зарегистрироваться в системе.',
        keyboardLogin);
    }
  }
});

/**
 * Регистрация в системе. Привязка ИД телеграма к учетной записи
 * в системе расчета зарплаты.
 */
bot.action('login', ctx => {
  if (ctx.chat) {
    loginDialog(ctx, true);
  }
});

bot.action('logout', async (ctx) => {
  if (ctx.chat) {
    await withMenu(ctx, '💔 До свидания!', keyboardLogin);
    const chatId = ctx.chat.id.toString();
    accountLink.delete(chatId);
    dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() }, ['employee']);
  }
});

bot.action('paySlip', ctx => {
  const today = new Date();
  const db = new Date(today.getFullYear()-1, today.getMonth() + 1, 1);
  const de = new Date(today.getFullYear()-1, today.getMonth() + 2, 0);
  const cListok = getPaySlip(ctx, 'CONCISE', db, de);
  cListok && withMenu(ctx, cListok, keyboardMenu, true);
});

bot.action('detailPaySlip', ctx => {
  const today = new Date();
  const db = new Date(today.getFullYear()-1, today.getMonth() + 1, 1);
  const de = new Date(today.getFullYear()-1, today.getMonth() + 2, 0);
  const cListok = getPaySlip(ctx, 'DETAIL', db, de);
  cListok && withMenu(ctx, cListok, keyboardMenu, true);
});

bot.action('paySlipByPeriod', ctx => {
  if (ctx.chat) {
    paySlipConciseDialog(ctx, true);
  }
});

bot.action('paySlipCompare', ctx => {
  if (ctx.chat) {
    paySlipCompareDialog(ctx, true);
  }
});

bot.action('settings', ctx => {
  if (ctx.chat) {
    dialogStates.merge(ctx.chat.id.toString(), { type: 'GETTING_SETTINGS', lastUpdated: new Date().getTime() });
    withMenu(ctx, 'Параметры', keyboardSettings);
  }
});

bot.action('menu', ctx => {
  if (ctx.chat) {
    withMenu(ctx, 'Выберите одно из предложенных действий', keyboardMenu, true);
  }
});

bot.action('getCurrency', ctx => {
  if (ctx.chat) {
    currencyDialog(ctx, true);
  }
});

bot.on('callback_query', async (ctx) => {
  if (ctx.chat) {
    const chatId = ctx.chat.id.toString();
    const dialogState = dialogStates.read(chatId);
    if (dialogState?.type === 'GETTING_CONCISE') {
      paySlipConciseDialog(ctx);
    } else if (dialogState?.type === 'GETTING_COMPARE') {
      paySlipCompareDialog(ctx)
    } else if (dialogState?.type === 'GETTING_CURRENCY') {
      currencyDialog(ctx);
    }
  }
})

bot.action('delete', ({ deleteMessage }) => deleteMessage());

bot.launch();

/**
 * При завершении работы сервера скидываем на диск все данные.
 */
process.on('exit', code => {
  accountLink.flush();
  dialogStates.flush();
  customers.flush();

  for (const ec of Object.values(employeesByCustomer)) {
    ec.flush();
  }

  console.log('Process exit event with code: ', code);
});

process.on('SIGINT', () => process.exit() );

