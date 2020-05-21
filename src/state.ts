/*

  1. Мы храним связь между chatId и работником в файле accountLink.json.
     Связь устанавливается и заносится после регистрации работника.
     Там же хранятся настройки акаунта, например, выбранная валюта.
  2. Диалог управляетя с помощью машины состояний.
  3. Связь между chatId и машиной хранится в специальном объекте.
  4. Когда поступает команда или текст из чата мы смотрим, есть ли у нас
     уже машина для этого чата. Если есть, то создаем event на основании
     поступивших данных и передаем в машину. Если машины нет, то создаем ее
     и регистрируем в нашем объекте. Если машина создается для зарегистрированного
     работника, то переводим ее в состояние вывода главного меню.
  5. Сообщения и меню в чат посылаются через actions в машине состояний.

*/

import  { assign, interpret, Machine, Interpreter, MachineConfig, State } from 'xstate';
import fs from 'fs';
import { BotMachineEvent, IBotMachineContext, botMachineConfig } from './machine';
import { IUpdate } from './types';


const botMachine = Machine(botMachineConfig,
  {
    actions: {
      sendInvitation: () => console.log('Здравствуйте!'),
      askCompanyName: () => console.log('Введите наименование организации:')
    }
  }
);

let counter = 0;
let service = interpret(botMachine).start();

const getUpdate = (): IUpdate => ({
  platform: 'TELEGRAM',
  type: 'COMMAND',
  chatId: '1',
  body: '',
  reply: () => {}
});

const sequence: BotMachineEvent[] = [
  { type: 'START' },
  { type: 'ENTER_TEXT', text: 'abc' },
  { type: 'ENTER_TEXT', text: 'bmkk' },
  { type: 'ENTER_TEXT', text: '002' },
  { type: 'ENTER_TEXT', text: '001' },
  { type: 'MENU_COMMAND', command: 'payslip' },
  { type: 'MENU_COMMAND', command: 'payslipForPeriod' },
  { type: 'CHANGE_YEAR', delta: -1 },
  { type: 'CANCEL_CALENDAR' },
  { type: 'MENU_COMMAND', command: 'payslipForPeriod' },
  { type: 'CHANGE_YEAR', delta: -1 },
  { type: 'SELECT_MONTH', month: 2 },
  { type: 'CHANGE_YEAR', delta: +1 },
];

const sequence2: BotMachineEvent[] = [
  { type: 'SELECT_MONTH', month: 6 },
  { type: 'MENU_COMMAND', command: 'payslipForPeriod' },
  { type: 'CANCEL_CALENDAR' },
  { type: 'MENU_COMMAND', command: 'logout' },
];

for (const e of sequence) {
  console.log(`${(counter++).toString().padStart(2, '0')} State: ${service.state.toStrings().join(',')}`);
  if (Object.values(service.state.children).length) {
    console.log(`Child state: ${Object.values(service.state.children)[0].state.toStrings().join(',')}`);
  }
  console.log(`Input: ${JSON.stringify(e, undefined, 2)}`);
  service.send(e);
};

const jsonState = JSON.stringify(service.state.toJSON(), undefined, 2);
const stateDefinition = JSON.parse(jsonState);
const previousState = State.create<IBotMachineContext, BotMachineEvent>(stateDefinition);
const resolvedState = botMachine.resolveState(previousState);
service = interpret(botMachine).start(resolvedState);

fs.writeFileSync('./state_before.json', jsonState);

//for (const child of Object.values(service.state.children)) {
  console.log(service.children);
//}

fs.writeFileSync('./state_after.json', JSON.stringify(service.state.toJSON(), undefined, 2));

for (const e of sequence2) {
  console.log(`${(counter++).toString().padStart(2, '0')} State: ${service.state.toStrings().join(',')}`);
  if (Object.values(service.state.children).length) {
    console.log(`Child state: ${Object.values(service.state.children)[0].state?.toStrings().join(',')}`);
  }
  console.log(`Input: ${JSON.stringify(e, undefined, 2)}`);
  service.send(e);
};

console.log(`Final state: ${service.state.toStrings().join(',')}`);
