import { Bot, Menu } from "./bot";
import Telegraf, { ContextMessageUpdate, Extra, Markup } from "telegraf";
import { getLanguage } from "./util/utils";
import { ICustomers, IEmploeeByCustomer, IPaySlip, IAccDed } from "./types";
import { IData } from "./util/fileDB";

export class TelegramBot extends Bot {
  private _bot: Telegraf<ContextMessageUpdate>;

  constructor(token: string,
    getCustomers: () => ICustomers,
    getEmployeesByCustomer: (customerId: string) => IEmploeeByCustomer,
    getAccDeds: (customerId: string) => IData<IAccDed>,
    getPaySlipByUser: (customerId: string, userId: string, year: number) => IData<IPaySlip>) {

    super('telegram', getCustomers, getEmployeesByCustomer, getAccDeds, getPaySlipByUser);

    this._bot = new Telegraf(token);

    this._bot.use((ctx, next) => {
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
    this._bot.action('login',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.loginDialog(ctx.chat.id.toString());
        }
      });

    this._bot.action('logout',
      async (ctx) => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.logout(ctx.chat.id.toString())
        }
      });

    this._bot.action('paySlip',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          const today = new Date();
          //Для теста период апрель 2019, потом удалить, когда будут данные
          const db = new Date(2019, 4, 1);
          const de = new Date(2019, 5, 0);
          this.paySlip(ctx.chat.id.toString(), 'CONCISE', getLanguage(ctx.from?.language_code), db, de);
        }
      });

    this._bot.action('detailPaySlip',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          const today = new Date();
          //Для теста период апрель 2019, потом удалить, когда будут данные
          const db = new Date(2019, 4, 1);
          const de = new Date(2019, 5, 0);
          this.paySlip(ctx.chat.id.toString(), 'DETAIL', getLanguage(ctx.from?.language_code), db, de);
        }
      });

    this._bot.action('paySlipByPeriod',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.paySlipDialog(ctx.chat.id.toString(), getLanguage(ctx.from?.language_code));
        }
      });

    this._bot.action('paySlipCompare',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.paySlipCompareDialog(ctx.chat.id.toString(), getLanguage(ctx.from?.language_code));
        }
      });

    this._bot.action('settings',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.settings(ctx.chat.id.toString())
        }
      });

    this._bot.action('menu',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.menu(ctx.chat.id.toString())
        }
      });

    this._bot.action('getCurrency',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.currencyDialog(ctx.chat.id.toString(), getLanguage(ctx.from?.language_code));
        }
      });

    this._bot.on('callback_query',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        }
        else if (ctx.callbackQuery?.data === undefined) {
          console.error('Invalid chat callbackQuery');
        } else {
          this.callback_query(ctx.chat.id.toString(), getLanguage(ctx.from?.language_code), ctx.callbackQuery?.data);
        }
      });

    this._bot.action('delete', ({ deleteMessage }) => deleteMessage());

    this._bot.launch();
  }

  get bot() {
    return this._bot;
  }

  private menu2markup(menu: Menu) {
    return Markup.inlineKeyboard(
      menu.map(r => r.map(
        c => c.type === 'BUTTON'
          ? Markup.callbackButton(c.caption, c.command) as any
          : Markup.urlButton(c.caption, c.url)
      ))
    );
  }

  editMessage(chatId: string, menu: Menu) {
    //редактировать меню периода не получилось
    //this.bot.telegram.editMessageReplyMarkup(chatId, undefined, undefined, menu);
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