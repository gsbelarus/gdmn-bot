import { Bot, Menu } from "../bot";
import { getLanguage, getSumByRate } from "../util/utils";
import { ICustomers, IEmploeeByCustomer, IPaySlip, IAccDed, ITypePaySlip } from "../types";
import { IData } from "../util/fileDB";

const vb = require('viber-bot');

const ViberBot = vb.Bot
const BotEvents = vb.Events
const TextMessage = vb.Message.Text;
const KeyboardMessage = vb.Message.Keyboard;

export class Viber extends Bot {
  private _bot: any;

  constructor(token: string,
    getCustomers: () => ICustomers,
    getEmployeesByCustomer: (customerId: string) => IEmploeeByCustomer,
    getAccDeds: (customerId: string) => IData<IAccDed>,
    getPaySlipByUser: (customerId: string, userId: string, year: number) => IData<IPaySlip>) {

    super('viber', getCustomers, getEmployeesByCustomer, getAccDeds, getPaySlipByUser);

    this._bot = new ViberBot({
      authToken: token,
      name: 'GDMN Bot',
      avatar: ''
    });


    const ngrok = require('./get_public_url');
    const http = require('http');
    const port = process.env.PORT || 8080;
    ngrok.getPublicUrl().then((publicUrl: string) => {
      console.log('Set the new webhook to"', publicUrl);
      http.createServer(this._bot.middleware()).listen(port, () => this._bot.setWebhook(publicUrl));
    }).catch((error: any) => {
      console.log('Can not connect to ngrok server. Is it running?');
      console.error(error);
    });

    this._bot.on(BotEvents.SUBSCRIBED, async (response: any) => {
      //Непонятно, когда сюда заходит
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.start(response.userProfile.id.toString());
      }
    });

    this._bot.on(BotEvents.CONVERSATION_STARTED, async (response: any, isSubscribed: boolean) => {
      console.log('start');
      // if (isSubscribed) {
      //   return;
      // }

      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.start(response.userProfile.id.toString());
      }
    });

    this._bot.on(BotEvents.MESSAGE_RECEIVED, async (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      }
      else if (message?.text === undefined) {
        console.error('Invalid chat message');
      } else {
        this.process(response.userProfile.id.toString(), message.text);
      }
    });

    this._bot.on(BotEvents.MESSAGE_RECEIVED, async (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      }
      else if (message?.text === undefined) {
        console.error('Invalid chat callbackQuery');
      } else {
        this.callback_query(response.userProfile.id.toString(), getLanguage(response.userProfile.language), message.text);
      }
    });

    this._bot.onTextMessage(/login/, async (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.loginDialog(response.userProfile.id.toString(), undefined, true);
      }
    });

    this._bot.onTextMessage(/logout/, async (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.logout(response.userProfile.id.toString())
      }
    });

    this._bot.onTextMessage(/paySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        const today = new Date();
        //Для теста период апрель 2019, потом удалить, когда будут данные
        const db = new Date(2019, 4, 1);
        const de = new Date(2019, 5, 0);
        this.paySlip(response.userProfile.id.toString(), 'CONCISE', getLanguage(response.userProfile.language), db, de);
      }
    });

    this._bot.onTextMessage(/detailPaySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        const today = new Date();
        //Для теста период апрель 2019, потом удалить, когда будут данные
        const db = new Date(2019, 4, 1);
        const de = new Date(2019, 5, 0);
        this.paySlip(response.userProfile.id.toString(), 'DETAIL', getLanguage(response.userProfile.language), db, de);
      }
    });

    this._bot.onTextMessage(/concisePaySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.paySlipDialog(response.userProfile.id.toString(), getLanguage(response.userProfile.language), undefined, true);
      }
    });

    this._bot.onTextMessage(/comparePaySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.paySlipCompareDialog(response.userProfile.id.toString(), getLanguage(response.userProfile.language), undefined, true);
      }
    });

    this._bot.onTextMessage(/settings/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.settings(response.userProfile.id.toString())
      }
    });

    this._bot.onTextMessage(/menu/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.menu(response.userProfile.id.toString())
      }
    });

    this._bot.onTextMessage(/getCurrency/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.currencyDialog(response.userProfile.id.toString(), getLanguage(response.userProfile.language), undefined, true);
      }
    });

    // this._bot.action('delete', ({ deleteMessage }) => deleteMessage());

    //this._bot.launch();
  }

  private _menu2ViberMenu(menu: Menu) {
    const res: any[] = [];

    for (const row of menu) {
      let buttonWidth = Math.floor(6 / row.length);

      if (!buttonWidth) {
        buttonWidth = 1;
      }

      for (const col of row) {
        if (col.type === 'BUTTON') {
          res.push({
            Columns: buttonWidth,
            Rows: 1,
            ActionType: 'reply',
            ActionBody: col.command,
            Text: `<font color=\"#ffffff\">${col.caption}</font>`,
            BgColor: '#7360f2'
          });
        } else {
          res.push({
            Columns: buttonWidth,
            Rows: 1,
            ActionType: 'open-url',
            ActionBody: col.url,
            Text: `<font color=\"#ffffff\">${col.caption}</font>`,
            BgColor: '#7360f2'
          });
        }
      }
    }

    return {
      Type: 'keyboard',
      Buttons: res
    };
  }

  get bot() {
    return this._bot;
  }

  async editMessageReplyMarkup(chatId: string, menu: Menu) {
    await this._bot.sendMessage({ id: chatId }, [new KeyboardMessage(this._menu2ViberMenu(menu))]);
  }

  async deleteMessage(chatId: string) {

  }

  async sendMessage(chatId: string, message: string, menu?: Menu, markdown?: boolean) {
    if (menu) {
      await this._bot.sendMessage({ id: chatId }, [new TextMessage(message), new KeyboardMessage(this._menu2ViberMenu(menu))]);
    } else {
      await this._bot.sendMessage({ id: chatId }, [new TextMessage(message)]);
    }
  }

  getPaySlipString(prevStr: string, name: string, s: number) {
    return `${prevStr}${prevStr !== '' ? '\r\n' : ''}  ${name}\r\n  =${s}`
  }

  paySlipView(typePaySlip: ITypePaySlip, db: Date, de: Date, dbMonthName: string, rate: number, deptName: string, posName: string, currencyAbbreviation: string,
    accrual: number[], advance: number[], ded: number[], allTaxes: number[], tax_ded: number[], privilage: number[], salary: number[], saldo: number[], incomeTax: number[], pensionTax: number[], tradeUnionTax: number[],
    strAccruals: string, strAdvances: string, strDeductions: string, strTaxes: string, strTaxDeds: string, strPrivilages: string, toDb?: Date, toDe?: Date) {
    switch (typePaySlip) {
      case 'DETAIL': {
        return (
`Расчетник за ${dbMonthName}
Начисления: ${getSumByRate(accrual[0], rate).toFixed(2)}
===========================
${strAccruals}
===========================
Аванс: ${getSumByRate(advance[0], rate).toFixed(2)}
===========================
${strAdvances}
===========================
Удержания: ${getSumByRate(ded[0], rate).toFixed(2)}
===========================
${strDeductions}
===========================
Налоги: ${allTaxes[0].toFixed(2)}
===========================
${strTaxes}
===========================
Вычеты: ${getSumByRate(tax_ded[0], rate).toFixed(2)}
===========================
${strTaxDeds}
===========================
Льготы: ${getSumByRate(privilage[0], rate).toFixed(2)}
===========================
${strPrivilages}
Подразделение:
${deptName}
Должность:
${posName}
Оклад: ${getSumByRate(salary[0], rate).toFixed(2)}
Валюта: ${currencyAbbreviation}`)
      }
      case 'CONCISE': {
        const m = de.getFullYear() !== db.getFullYear() || de.getMonth() !== db.getMonth() ? `с ${db.toLocaleDateString()} по ${de.toLocaleDateString()}` : `${dbMonthName}`;
        return (
`Расчетник
${m}
Начислено: ${getSumByRate(accrual[0], rate).toFixed(2)}
===========================
Зарплата чистыми: ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2)}
Аванс: ${getSumByRate(advance[0], rate).toFixed(2)}
К выдаче: ${getSumByRate(saldo[0], rate).toFixed(2)}
Удержания: ${getSumByRate(ded[0], rate).toFixed(2)}
===========================
Налоги: ${allTaxes[0].toFixed(2)}
Подоходный: ${getSumByRate(incomeTax[0], rate).toFixed(2)}
Пенсионный: ${getSumByRate(pensionTax[0], rate).toFixed(2)}
Профсоюзный: ${getSumByRate(tradeUnionTax[0], rate).toFixed(2)}
===========================
Подразделение:
${deptName}
Должность:
${posName}
Оклад: ${getSumByRate(salary[0], rate).toFixed(2)}
Валюта: ${currencyAbbreviation}`);
      }
      case 'COMPARE': {
        if (toDb && toDe) {
          return (
`Сравнение расчетных листков
Период I: ${db.toLocaleDateString()} - ${de.toLocaleDateString()}
Период II: ${toDb.toLocaleDateString()} - ${toDe.toLocaleDateString()}

Начислено I: ${getSumByRate(accrual[0], rate).toFixed(2)}
Начислено II:${getSumByRate(accrual[1], rate).toFixed(2)}
Разница: ${(getSumByRate(accrual[1], rate) - getSumByRate(accrual[0], rate)).toFixed(2)}
===========================
Зарплата чистыми I: ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2)}
Зарплата чистыми II: ${(getSumByRate(accrual[1], rate) - allTaxes[1]).toFixed(2)}
Разница: ${(getSumByRate(accrual[1], rate) - allTaxes[1] - (getSumByRate(accrual[0], rate) - allTaxes[0])).toFixed(2)}
Аванс I: ${getSumByRate(advance[0], rate).toFixed(2)}
Аванс II: ${getSumByRate(advance[1], rate).toFixed(2)}
Разница: ${(getSumByRate(advance[1], rate) - getSumByRate(advance[0], rate)).toFixed(2)}
К выдаче I: ${getSumByRate(saldo[0], rate).toFixed(2)}
К выдаче II:${getSumByRate(saldo[1], rate).toFixed(2)}
Разница: ${(getSumByRate(saldo[1], rate) - getSumByRate(saldo[0], rate)).toFixed(2)}
Удержания I: ${getSumByRate(ded[0], rate).toFixed(2)}
Удержания II:${getSumByRate(ded[1], rate).toFixed(2)}
Разница: ${(getSumByRate(ded[1], rate) - getSumByRate(ded[0], rate)).toFixed(2)}
===========================
Налоги I: ${allTaxes[0].toFixed(2)}
Налоги II: ${allTaxes[1].toFixed(2)}
Разница: ${(allTaxes[1] - allTaxes[0]).toFixed(2)}
Подоходный I: ${getSumByRate(incomeTax[0], rate).toFixed(2)}
Подоходный II:.${getSumByRate(incomeTax[1], rate).toFixed(2)}
Разница: ${(getSumByRate(incomeTax[1], rate) - getSumByRate(incomeTax[0], rate)).toFixed(2)}
Пенсионный I: ${getSumByRate(pensionTax[0], rate).toFixed(2)}
Пенсионный II: ${getSumByRate(pensionTax[1], rate).toFixed(2)}
Разница: ${(getSumByRate(pensionTax[1], rate) - getSumByRate(pensionTax[0], rate)).toFixed(2)}
Профсоюзный I: ${getSumByRate(tradeUnionTax[0], rate).toFixed(2)}
Профсоюзный II:${getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate).toFixed(2)}
Разница: ${(getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate) - getSumByRate(tradeUnionTax[0], rate)).toFixed(2)}
===========================
Подразделение:
${deptName}
Должность:
${posName}
Оклад I: ${getSumByRate(salary[0], rate).toFixed(2)}
Оклад II: ${getSumByRate(salary[1], rate).toFixed(2)}
Разница: ${(getSumByRate(salary[1], rate) - getSumByRate(salary[0], rate)).toFixed(2)}
Валюта: ${currencyAbbreviation}`);
        }
      }
    }
    return;
  }
};