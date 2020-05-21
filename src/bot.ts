import { FileDB } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate } from "./types";
import Telegraf, { Context, Extra, Markup } from "telegraf";
import { Interpreter, MachineConfig, Machine, StateMachine, interpret } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent } from "./machine";
import { getLocString } from "./stringResources";
import path from 'path';

export class Bot {
  private _telegramAccountLink: FileDB<IAccountLink>;
  private _viberAccountLink: FileDB<IAccountLink>;
  private _telegram: Telegraf<Context>;
  private _service: { [id: string]: Interpreter<any> } = {};
  private _machine: StateMachine<any, any, any>;

  constructor(telegramToken: string, telegramRoot: string, viberRoot: string) {
    this._telegramAccountLink = new FileDB<IAccountLink>(path.resolve(telegramRoot, `/accountlink.json`));
    this._viberAccountLink = new FileDB<IAccountLink>(path.resolve(viberRoot, `/accountlink.json`));

    this._machine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig,
      {
        actions: {
          sendInvitation: (_, { update }) => update?.reply?.(getLocString('invitation')),
          askCompanyName: () => console.log('Введите наименование организации:')
        }
      }
    );

    this._telegram = new Telegraf(telegramToken);

    this._telegram.use((ctx, next) => {
      console.log(`Chat ${ctx.chat?.id}: ${ctx.updateType} ${ctx.message?.text !== undefined ? ('-- ' + ctx.message?.text) : ''}`);
      return next?.();
    });

    this._telegram.start(
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.onUpdate({
            platform: 'TELEGRAM',
            chatId: ctx.chat.id.toString(),
            type: 'COMMAND',
            body: '/start',
            reply: ctx.reply
          });
        }
      }
    );

    this._telegram.on('message',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        }
        else if (ctx.message?.text === undefined) {
          console.error('Invalid chat message');
        } else {
          this.onUpdate({
            platform: 'TELEGRAM',
            chatId: ctx.chat.id.toString(),
            type: 'MESSAGE',
            body: ctx.message.text
          });
        }
      }
    );
  }

  launch() {
    this._telegram.launch();
  }

  getMachineId(platform: Platform, chatId: string) {
    return chatId + (platform === 'TELEGRAM' ? 't' : 'v');
  }

  finalize() {
    this._telegramAccountLink.flush();
    this._viberAccountLink.flush();
  }

  /**
   * Сюда поступают все события из чатов пользователей: ввод текста,
   * выбор пункта в меню, вызов команды и т.п.
   * @param update IUpdate
   */
  onUpdate(update: IUpdate) {
    const { platform, chatId } = update;
    const machineId = this.getMachineId(platform, chatId);
    const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
    let accountLink = accountLinkDB.read(chatId);

    if (accountLink) {
      let service = this._service[machineId];
      if (!service) {
        // чат авторизован, но интерпретатора стэйт машины нет. Сервер перезагрузили
        // или почистили память. Создадим новый сервис и начнем с главного меню
        service = interpret(this._machine).start();
        this._service[machineId] = service;

        // TODO: здесь надо перевести сервис в состояние главного меню
        // ...
      } else {
        // посылаем в сервис событие
        // если это команда start то надо начать с главного меню
      }
    } else {
      // новый пользователь/чат. все создаем и начинаем регистрацию
      const service = interpret(this._machine).start();
      this._service[machineId] = service;
      service.send({ type: 'START' });
    }
  }
};