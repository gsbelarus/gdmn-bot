import { Bot, Menu } from "../bot";
import { getLanguage, getSumByRate } from "../util/utils";
import { ICustomers, IEmploeeByCustomer, IPaySlip, IAccDed } from "../types";
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
      name: 'Моя зарплата',
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
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.start(response.userProfile.id.toString(), 'Для подписки введите любое сообщение.');
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
        const db = new Date(today.getFullYear(), today.getMonth(), 1);
        const de = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.paySlip(response.userProfile.id.toString(), 'CONCISE', getLanguage(response.userProfile.language), db, de);
      }
    });

    this._bot.onTextMessage(/detailPaySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        const today = new Date();
        const db = new Date(today.getFullYear(), today.getMonth(), 1);
        const de = new Date(today.getFullYear(), today.getMonth() + 1, 0);
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
    return `${prevStr}${prevStr !== '' ? '\n' : ''}  ${name}\n  =${s}`
  }

  paySlipView(template: [string, number?, boolean?][], rate: number) {
    const res = template.map( t =>
      t[1] === undefined
      ? t[0]
      : t[2] !== undefined
      ? `${t[0] === '' ? 'Разница:' : t[0]}  ${getSumByRate(t[1], rate).toFixed(2)}`
      : `${t[0] === '' ? 'Разница:' : t[0]}  ${t[1].toFixed(2)}`
    ).join('\n');
    return res;
  }
};