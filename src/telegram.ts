import { Bot, Menu } from "./bot";
import Telegraf, { ContextMessageUpdate, Extra, Markup } from "telegraf";
import { getLanguage, getSumByRate } from "./util/utils";
import { ICustomers, IEmploeeByCustomer, IPaySlip, IAccDed, ITypePaySlip } from "./types";
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
          this.start(ctx.chat.id.toString(), 'Для получения информации о заработной плате необходимо зарегистрироваться в системе.');
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
          this.loginDialog(ctx.chat.id.toString(), undefined, true);
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

    this._bot.action('concisePaySlip',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.paySlipDialog(ctx.chat.id.toString(), getLanguage(ctx.from?.language_code), undefined, true);
        }
      });

    this._bot.action('comparePaySlip',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.paySlipCompareDialog(ctx.chat.id.toString(), getLanguage(ctx.from?.language_code), undefined, true);
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
          this.currencyDialog(ctx.chat.id.toString(), getLanguage(ctx.from?.language_code), undefined, true);
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

  /**
  * Разделяем длинную строку на две
   * @param prevStr
   * @param name
   * @param s
   */
  getPaySlipString(prevStr: string, name: string, s: number) {
    let name_1 = '';
    const len = 28;
    if (name.length > len) {
      name_1 = name.length > len ? name.slice(0, len) : name;
      name = name.slice(len).padEnd(len);
      return `${prevStr}${prevStr !== '' ? '\r\n' : ''}  ${name_1}\r\n${name}\r\n  =${s.toFixed(2)}`;
    } else {
      return `${prevStr}${prevStr !== '' ? '\r\n' : ''}  ${name.padEnd(len)}\r\n  =${s.toFixed(2)}`;
    }
  }

  paySlipView(typePaySlip: ITypePaySlip, db: Date, de: Date, dbMonthName: string, rate: number, deptName: string, posName: string, currencyAbbreviation: string,
    accrual: number[], advance: number[], ded: number[], allTaxes: number[], tax_ded: number[], privilage: number[], salary: number[], saldo: number[], incomeTax: number[], pensionTax: number[], tradeUnionTax: number[],
    strAccruals: string, strAdvances: string, strDeductions: string, strTaxes: string, strTaxDeds: string, strPrivilages: string, toDb?: Date, toDe?: Date) {
    const lenS = 9;
    switch (typePaySlip) {
      case 'DETAIL': {
        const len = 20;
        return (`${'`'}${'`'}${'`'}ini
Расчетный листок
Период: ${dbMonthName}
${'Начисления:'.padEnd(len)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)}
===============================
${strAccruals}
===============================
${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)}
===============================
${strAdvances}
===============================
${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)}
===============================
${strDeductions}
===============================
${'Налоги:'.padEnd(len)}  ${allTaxes[0].toFixed(2).padStart(lenS)}
===============================
${strTaxes}
===============================
${'Вычеты:'.padEnd(len)}  ${getSumByRate(tax_ded[0], rate).toFixed(2).padStart(lenS)}
===============================
${strTaxDeds}
===============================
${'Льготы:'.padEnd(len)}  ${getSumByRate(privilage[0], rate).toFixed(2).padStart(lenS)}
===============================
${strPrivilages}
${'Подразделение:'.padEnd(len)}
${deptName}
${'Должность:'.padEnd(len)}
${posName}
${'Оклад:'.padEnd(len)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)}
${'Валюта:'.padEnd(len)}  ${currencyAbbreviation.padStart(lenS)}
${'`'}${'`'}${'`'}`)
      }
      case 'CONCISE': {
        const len = 20;
        const m = de.getFullYear() !== db.getFullYear() || de.getMonth() !== db.getMonth() ? `${db.toLocaleDateString()}-${de.toLocaleDateString()}` : `${dbMonthName}`;
        return (`${'`'}${'`'}${'`'}ini
Расчетный листок
Период: ${m}
${'Начислено:'.padEnd(len)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)}
===============================
${'Зарплата чистыми:'.padEnd(len)}  ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2).padStart(lenS)}
${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)}
${'К выдаче:'.padEnd(len)}  ${getSumByRate(saldo[0], rate).toFixed(2).padStart(lenS)}
${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)}
===============================
${'Налоги:'.padEnd(len)}  ${allTaxes[0].toFixed(2).padStart(lenS)}
${'Подоходный:'.padEnd(len)}  ${getSumByRate(incomeTax[0], rate).toFixed(2).padStart(lenS)}
${'Пенсионный:'.padEnd(len)}  ${getSumByRate(pensionTax[0], rate).toFixed(2).padStart(lenS)}
${'Профсоюзный:'.padEnd(len)}  ${getSumByRate(tradeUnionTax[0], rate).toFixed(2).padStart(lenS)}
===============================
${'Подразделение:'.padEnd(len)}
${deptName}
${'Должность:'.padEnd(len)}
${posName}
${'Оклад:'.padEnd(len)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)}
${'Валюта:'.padEnd(len)}  ${currencyAbbreviation.padStart(lenS)}
${'`'}${'`'}${'`'}`);
      }
      case 'COMPARE': {
        if (toDb && toDe) {
          const len = 20;
          return (`${'`'}${'`'}${'`'}ini
${'Сравнение расчетных листков'.padEnd(len)}
Период I:  ${db.toLocaleDateString()}-${de.toLocaleDateString()}
Период II: ${toDb.toLocaleDateString()}-${toDe.toLocaleDateString()}
${'Начислено I:'.padEnd(len)} ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)}
${'          II:'.padEnd(len)} ${getSumByRate(accrual[1], rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(accrual[1], rate) - getSumByRate(accrual[0], rate)).toFixed(2).padStart(lenS)}
===============================
${'Зарплата чистыми I:'.padEnd(len)} ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2).padStart(lenS)}
${'                 II'.padEnd(len)} ${(getSumByRate(accrual[1], rate) - allTaxes[1]).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(accrual[1], rate) - allTaxes[1] - (getSumByRate(accrual[0], rate) - allTaxes[0])).toFixed(2).padStart(lenS)}
${'Аванс I:'.padEnd(len)} ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)}
${'Аванс II:'.padEnd(len)} ${getSumByRate(advance[1], rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(advance[1], rate) - getSumByRate(advance[0], rate)).toFixed(2).padStart(lenS)}
${'К выдаче I:'.padEnd(len)} ${getSumByRate(saldo[0], rate).toFixed(2).padStart(lenS)}
${'К выдаче II:'.padEnd(len)} ${getSumByRate(saldo[1], rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(saldo[1], rate) - getSumByRate(saldo[0], rate)).toFixed(2).padStart(lenS)}
${'Удержания I:'.padEnd(len)} ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)}
${'Удержания II:'.padEnd(len)} ${getSumByRate(ded[1], rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(ded[1], rate) - getSumByRate(ded[0], rate)).toFixed(2).padStart(lenS)}
===============================
${'Налоги I:'.padEnd(len)} ${allTaxes[0].toFixed(2).padStart(lenS)}
${'Налоги II:'.padEnd(len)} ${allTaxes[1].toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(allTaxes[1] - allTaxes[0]).toFixed(2).padStart(lenS)}
${'Подоходный I:'.padEnd(len)} ${getSumByRate(incomeTax[0], rate).toFixed(2).padStart(lenS)}
${'Подоходный II:'.padEnd(len)} ${getSumByRate(incomeTax[1], rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(incomeTax[1], rate) - getSumByRate(incomeTax[0], rate)).toFixed(2).padStart(lenS)}
${'Пенсионный I:'.padEnd(len)} ${getSumByRate(pensionTax[0], rate).toFixed(2).padStart(lenS)}
${'Пенсионный II:'.padEnd(len)} ${getSumByRate(pensionTax[1], rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(pensionTax[1], rate) - getSumByRate(pensionTax[0], rate)).toFixed(2).padStart(lenS)}
${'Профсоюзный I:'.padEnd(len)} ${getSumByRate(tradeUnionTax[0], rate).toFixed(2).padStart(lenS)}
${'Профсоюзный II:'.padEnd(len)} ${getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate) - getSumByRate(tradeUnionTax[0], rate)).toFixed(2).padStart(lenS)}
===============================
${'Подразделение:'.padEnd(len)}
${deptName}
${'Должность:'.padEnd(len)}
${posName}
${'Оклад I:'.padEnd(len)} ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)}
${'Оклад II:'.padEnd(len)} ${getSumByRate(salary[1], rate).toFixed(2).padStart(lenS)}
${''.padEnd(len)} ${(getSumByRate(salary[1], rate) - getSumByRate(salary[0], rate)).toFixed(2).padStart(lenS)}
${'Валюта:'.padEnd(len)} ${currencyAbbreviation.padStart(lenS)}
${'`'}${'`'}${'`'}`);
        }
      }
    }
    return;
  }

  async editMessageReplyMarkup(chatId: string, menu: Menu, userProfile?: any) {
    const dialogState = this.dialogStates.read(chatId);
    let m: any;
    if (dialogState) {
      if (dialogState.menuMessageId) {
        try {
          this.bot.telegram.editMessageReplyMarkup(chatId, dialogState.menuMessageId, undefined, JSON.stringify(this.menu2markup(menu)));
        }
        catch (e) {
          // TODO: если сообщение уже было удалено из чата, то
          // будет ошибка, которую мы подавляем.
          // В будущем надо ловить события удаления сообщения
          // и убирать его ИД из сохраненных данных
        }
      }
    }
  }

  async deleteMessage(chatId: string) {
    const dialogState = this.dialogStates.read(chatId);
    let m: any;
    if (dialogState) {
      if (dialogState.menuMessageId) {
        try {
          await this.bot.telegram.deleteMessage(chatId, dialogState.menuMessageId);
        }
        catch (e) {
          // TODO: если сообщение уже было удалено из чата, то
          // будет ошибка, которую мы подавляем.
          // В будущем надо ловить события удаления сообщения
          // и убирать его ИД из сохраненных данных
        }
      }
    }
  }

  async sendMessage(chatId: string, message: string, menu?: Menu, markdown?: boolean, userProfile?: any) {
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