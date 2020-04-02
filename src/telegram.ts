import { Bot, Menu } from "./bot";
import Telegraf, { ContextMessageUpdate, Extra, Markup } from "telegraf";
import { normalizeStr, getLanguage } from "./util/utils";

export class TelegramBot extends Bot {
  private _bot: Telegraf<ContextMessageUpdate>;

  constructor(token: string) {
    super('telegram');

    this._bot = new Telegraf(token);

    this._bot.use( (ctx, next) => {
      console.log(`Chat ${ctx.chat?.id}: ${ctx.updateType} ${ctx.message?.text !== undefined ? ('-- ' + ctx.message?.text) : ''}`);
      return next?.();
    });

    this._bot.start(
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.start(ctx.chat.id.toString());
        }
      }
      );

    this._bot.on('message',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        }
        else if (ctx.message?.text === undefined) {
          console.error('Invalid chat message');
        } else {
          this.process(ctx.chat.id.toString(), ctx.message.text);
        }
      }
    );

    /**
     * Регистрация в системе. Привязка ИД телеграма к учетной записи
     * в системе расчета зарплаты.
     */
    this.bot.action('login', ctx => {
      if (ctx.chat) {
        this.loginDialog(ctx.chat.id.toString());
      }
    });

    this.bot.action('logout', async (ctx) => {
      if (ctx.chat) {
        this.logout(ctx.chat.id.toString())
      }
    });

    this.bot.action('paySlip', ctx => {
      if (ctx.chat) {
        const today = new Date();
        const db = new Date(2019, 4, 1);
        const de = new Date(2019, 5, 0);
        this.paySlip(ctx.chat.id.toString(), 'CONCISE', getLanguage(ctx.from?.language_code), db, de);
      }
    });

    this.bot.action('detailPaySlip', ctx => {
      if (ctx.chat) {
        const today = new Date();
        const db = new Date(2019, 4, 1);
        const de = new Date(2019, 5, 0);
        this.paySlip(ctx.chat.id.toString(), 'DETAIL', getLanguage(ctx.from?.language_code), db, de);
      }
    });

    // this.bot.action('paySlipByPeriod', ctx => {
    //   if (ctx.chat) {
    //     paySlipDialog(ctx, true);
    //   }
    // });

    // this.bot.action('paySlipCompare', ctx => {
    //   if (ctx.chat) {
    //     paySlipCompareDialog(ctx, true);
    //   }
    // });

    // this.bot.action('settings', ctx => {
    //   if (ctx.chat) {
    //     const chatId = ctx.chat.id.toString();
    //     dialogStates.merge(chatId, { type: 'GETTING_SETTINGS', lastUpdated: new Date().getTime() });
    //     withMenu(ctx, 'Параметры', keyboardSettings);
    //   }
    // });

    // this.bot.action('menu', ctx => {
    //   if (ctx.chat) {
    //     withMenu(ctx, 'Выберите одно из предложенных действий', keyboardMenu, true);
    //   }
    // });

    // bot.action('getCurrency', ctx => {
    //   if (ctx.chat) {
    //     currencyDialog(ctx, true);
    //   }
    // });

    // bot.on('callback_query', async (ctx) => {
    //   if (ctx.chat) {
    //     const chatId = ctx.chat.id.toString();
    //     const dialogState = dialogStates.read(chatId);
    //     if (dialogState?.type === 'GETTING_CONCISE') {
    //       paySlipDialog(ctx);
    //     } else if (dialogState?.type === 'GETTING_COMPARE') {
    //       paySlipCompareDialog(ctx)
    //     } else if (dialogState?.type === 'GETTING_CURRENCY') {
    //       currencyDialog(ctx);
    //     }
    //   }
    // })

    // bot.action('delete', ({ deleteMessage }) => deleteMessage());


    this._bot.launch();
  }

  get bot() {
    return this._bot;
  }

  private menu2markup(menu: Menu) {
    return Markup.inlineKeyboard(
      menu.map( r => r.map(
        c => c.type === 'BUTTON'
          ? Markup.callbackButton(c.caption, c.command) as any
          : Markup.urlButton(c.caption, c.url)
      ))
    );
  }

  async sendMessage(chatId: string, message: string, menu?: Menu, markdown?: boolean) {
    const m = markdown
      ? await this.bot.telegram.sendMessage(chatId, message, menu && { parse_mode: 'MarkdownV2', ...Extra.markup(this.menu2markup(menu)) })
      : await this.bot.telegram.sendMessage(chatId, message, menu && Extra.markup(this.menu2markup(menu)));

    const dialogState = this.dialogStates.read(chatId);

    if (dialogState) {
      if (dialogState.menuMessageId) {
        try {
          await this.bot.telegram.editMessageReplyMarkup(chatId, dialogState.menuMessageId);
        }
        catch (e) {
          // TODO: если сообщение уже было удалено из чата, то
          // будет ошибка, которую мы подавляем.
          // В будущем надо ловить события удаления сообщения
          // и убирать его ИД из сохраненных данных
        }
      }

      if (menu) {
        this.dialogStates.merge(chatId, { menuMessageId: m.message_id });
      } else {
        this.dialogStates.merge(chatId, { menuMessageId: undefined });
      }
    }
  }
};

