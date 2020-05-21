import { FileDB } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate } from "./types";
import Telegraf, { Context } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent } from "./machine";
import { getLocString, StringResource } from "./stringResources";
import path from 'path';

const reply = (s: StringResource) => (_: any, { update }: BotMachineEvent) => update?.reply?.(getLocString(s));

export class Bot {
  private _telegramAccountLink: FileDB<IAccountLink>;
  private _viberAccountLink: FileDB<IAccountLink>;
  private _telegram: Telegraf<Context>;
  private _service: { [id: string]: Interpreter<IBotMachineContext, any, BotMachineEvent> } = {};
  private _machine: StateMachine<IBotMachineContext, any, BotMachineEvent>;

  constructor(telegramToken: string, telegramRoot: string, viberRoot: string) {
    this._telegramAccountLink = new FileDB<IAccountLink>(path.resolve(telegramRoot, `/accountlink.json`));
    this._viberAccountLink = new FileDB<IAccountLink>(path.resolve(viberRoot, `/accountlink.json`));

    this._machine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig,
      {
        actions: {
          sendInvitation: reply('invitation'),
          askCompanyName: reply('askCompanyName')
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

  createService(machineId: string) {
    const service = interpret(this._machine)
      .onTransition( (state, event) => console.log(`State: ${state.toStrings().join('->')}, Event: ${event.type}`) )
      .start();
    this._service[machineId] = service;
    return service;
  }

  /**
   * Сюда поступают все события из чатов пользователей: ввод текста,
   * выбор пункта в меню, вызов команды и т.п.
   * @param update IUpdate
   */
  onUpdate(update: IUpdate) {
    const { platform, chatId, type, body } = update;
    const machineId = this.getMachineId(platform, chatId);
    let service = this._service[machineId];
    const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
    let accountLink = accountLinkDB.read(chatId);

    if (body === '/start' || !service) {
      this.createService(machineId).send({ type: accountLink ? 'MAIN_MENU' : 'START', update });
    } else {
      if (type === 'MESSAGE') {
        service.send({ type: 'ENTER_TEXT', text: body, update });
      }
    }
  }
};