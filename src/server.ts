import Koa from "koa";
import Router from 'koa-router';
import https from 'https';
import fs from 'fs';
import path from 'path';
import Telegraf, { Extra, Markup, ContextMessageUpdate } from 'telegraf';
import { IAccountLink, IDialogStateLoggingIn, DialogState, ICustomer, IEmployee } from "./types";
import { FileDB } from "./fileDB";
import { normalizeStr } from "./utils";
import { InlineKeyboardMarkup } from "telegraf/typings/telegram-types";

const cListok =
`${'`'}${'`'}${'`'}ini
Начислено:           726.87
===========================
Зарплата (чистыми):  617.84
  К выдаче:          502.12
  Удержания:         115.72
===========================
Налоги:              109.03
  Подоходный:         94.49
  Пенсионный:          7.27
  Профсоюзный:         7.27
===========================
Информация:
  Участок глубокой печати моф (угп моф)
  Клеевар
  Оклад:             450.24
${'`'}${'`'}${'`'}`;

const accountLink = new FileDB<IAccountLink>(path.resolve(process.cwd(), 'data/accountlink.json'), {});
const dialogStates = new FileDB<DialogState>(path.resolve(process.cwd(), 'data/dialogstates.json'), {});
const customers = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'), {});
const employeesByCustomer: { [customerId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};

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

router.get('/', (ctx, next) => {
  // ctx.router available
  ctx.body = 'Hello World!';
  next();
});

app
  .use(router.routes())
  .use(router.allowedMethods());

const serverCallback = app.callback();

//http.createServer(serverCallback).listen(3000);
https.createServer(config.https.options, serverCallback).listen(config.https.port);

const withMenu = async (ctx: ContextMessageUpdate, msg: string, menu?: Markup & InlineKeyboardMarkup, markdown?: boolean) => {
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
      await bot.telegram.editMessageReplyMarkup(ctx.chat.id, dialogState.menuMessageId);
    }

    if (menu) {
      dialogStates.merge(chatId, { menuMessageId: m.message_id });
    } else {
      dialogStates.merge(chatId, { menuMessageId: undefined });
    }
  }
};

const loginDialog = async (ctx: ContextMessageUpdate, start = false) => {
  if (!ctx.chat) {
    throw new Error('Invalid context');
  }

  const chatId = ctx.chat.id.toString();

  if (start) {
    await withMenu(ctx, 'Для регистрации в системе введите указанные данные.');
    dialogStates.merge(chatId, { type: 'LOGGING_IN', lastUpdated: new Date().getTime(), employee: {} });
  }

  const dialogState = dialogStates.getMutable(true)[chatId];

  if (!dialogState || dialogState.type !== 'LOGGING_IN') {
    throw new Error('Invalid dialog state');
  }

  const text = start ? '' : normalizeStr(ctx.message?.text);
  const { employee } = dialogState as IDialogStateLoggingIn;

  if (text) {
    if (!employee.customerId) {
      const found = Object.entries(customers.getMutable(false)).find( ([_, c]) =>
        normalizeStr(c.name) === text || c.aliases.find(
          a => normalizeStr(a) === text
        )
      );

      if (found) {
        employee.customerId = found[0];
      } else {
        await withMenu(ctx, '😕 Такого предприятия нет в базе данных!', keyboardLogin);
        dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() }, ['employee']);
        return;
      }
    }
    else if (!employee.firstName) {
      employee.firstName = text;
    }
    else if (!employee.lastName) {
      employee.lastName = text;
    }
    else if (!employee.patrName) {
      employee.patrName = text;
    }
    else if (!employee.passportId) {
      employee.passportId = text;
    }
    else if (!employee.tabNumber) {
      employee.tabNumber = text;
    }
  }

  if (employee.tabNumber && employee.customerId) {
    let employees = employeesByCustomer[employee.customerId];

    if (!employees) {
      employees = new FileDB<IEmployee>(path.resolve(process.cwd(), `data/employee.${employee.customerId}.json`), {});
      employeesByCustomer[employee.customerId] = employees;
    }

    const found = Object.entries(employees.getMutable(false)).find(
      ([_, e]) =>
        normalizeStr(e.firstName) === employee.firstName
        &&
        normalizeStr(e.lastName) === employee.lastName
        &&
        normalizeStr(e.patrName) === employee.patrName
        &&
        normalizeStr(e.passportId) === employee.passportId
        &&
        normalizeStr(e.tabNumber) === employee.tabNumber
    );

    if (found) {
      accountLink.merge(chatId, {
        customerId: employee.customerId,
        employeeId: found[0]
      });
      dialogStates.merge(chatId, { type: 'LOGGED_IN', lastUpdated: new Date().getTime() }, ['employee']);
      withMenu(ctx, '🏁 Регистрация прошла успешно.', keyboardMenu);
    } else {
      withMenu(ctx,
`
Сотрудник не найден в базе данных.

Обратитесь в отдел кадров или повторите регистрацию.

Были введены следующие данные:
Предприятие: ${employee.customerId}
Имя: ${employee.firstName}
Фамилия: ${employee.lastName}
Отчество: ${employee.patrName}
Идентификационный номер: ${employee.passportId}
Табельный номер: ${employee.tabNumber}
`, keyboardLogin);

      dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() }, ['employee']);
    }
  } else {
    if (!employee.customerId) {
      withMenu(ctx, 'Введите название предприятия:');
    }
    else if (!employee.firstName) {
      withMenu(ctx, 'Введите имя:');
    }
    else if (!employee.lastName) {
      withMenu(ctx, 'Введите фамилию:');
    }
    else if (!employee.patrName) {
      withMenu(ctx, 'Введите отчество:');
    }
    else if (!employee.passportId) {
      withMenu(ctx, 'Введите идентификационный номер из паспорта:');
    }
    else if (!employee.tabNumber) {
      withMenu(ctx, 'Введите табельный номер из расчетного листка:');
    }
  }
};

const keyboardLogin = Markup.inlineKeyboard([
  Markup.callbackButton('✏ Зарегистрироваться', 'login') as any,
  Markup.urlButton('❓', 'http://gsbelarus.com'),
]);

const keyboardMenu = Markup.inlineKeyboard([
  [Markup.callbackButton('💰 Расчетный листок', 'listok') as any],
  [
    Markup.callbackButton('🚪 Выйти', 'logout') as any,
    Markup.urlButton('❓', 'http://gsbelarus.com')
  ]
]);

if (typeof process.env.GDMN_BOT_TOKEN !== 'string') {
  throw new Error('GDMN_BOT_TOKEN env variable is not specified.');
}

const bot = new Telegraf(process.env.GDMN_BOT_TOKEN);

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

bot.action('listok', ctx => {
  if (ctx.chat) {
    withMenu(ctx, cListok, keyboardMenu, true);
  }
});

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
