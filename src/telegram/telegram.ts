import Telegraf, { Extra, Markup, ContextMessageUpdate } from 'telegraf';
import { InlineKeyboardMarkup } from "telegraf/typings/telegram-types";
import { paySlipDialog } from "./actions/paySlipDialog";
import { paySlipCompareDialog } from "./actions/paySlipCompareDialog";
import { keyboardLogin, keyboardMenu, keyboardSettings } from "./util/keybord";
import { loginDialog } from "./actions/loginDialog";
import { getPaySlip } from "./actions/getPaySlip";
import { currencyDialog } from "./actions/currencyDialog";
import { dialogStates, accountLink, customers } from "../server";


export default class TelegramBot {
  public static bot: Telegraf<ContextMessageUpdate>

  public static init = () => {
    if (typeof process.env.GDMN_BOT_TOKEN !== 'string') {
      throw new Error('GDMN_BOT_TOKEN env variable is not specified.');
    }

    const bot = new Telegraf(process.env.GDMN_BOT_TOKEN);

    TelegramBot.bot = bot

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
      const db = new Date(2019, 4, 1);
      const de = new Date(2019, 5, 0);
      const cListok = getPaySlip(ctx, 'CONCISE', db, de);
      cListok && withMenu(ctx, cListok, keyboardMenu, true);
    });

    bot.action('detailPaySlip', ctx => {
      const today = new Date();
      const db = new Date(2019, 4, 1);
      const de = new Date(2019, 5, 0);
      const cListok = getPaySlip(ctx, 'DETAIL', db, de);
      cListok && withMenu(ctx, cListok, keyboardMenu, true);
    });

    bot.action('paySlipByPeriod', ctx => {
      if (ctx.chat) {
        paySlipDialog(ctx, true);
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
          paySlipDialog(ctx);
        } else if (dialogState?.type === 'GETTING_COMPARE') {
          paySlipCompareDialog(ctx)
        } else if (dialogState?.type === 'GETTING_CURRENCY') {
          currencyDialog(ctx);
        }
      }
    })

    bot.action('delete', ({ deleteMessage }) => deleteMessage());

    bot.launch();

    return bot
  }
}

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
        await TelegramBot.bot.telegram.editMessageReplyMarkup(ctx.chat.id, dialogState.menuMessageId);
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


