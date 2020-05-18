import  { assign, interpret, Machine } from 'xstate';

interface IBotMachineContext {
  companyId?: string;
  employeeId?: string;
};

type StartEvent = { type: 'START' };
type NextEvent = { type: 'NEXT' };
type EnterTextEvent = { type: 'ENTER_TEXT'; text: string; };
type MenuCommandEvent = { type: 'MENU_COMMAND'; command: string; };

type BotMachineEvent = StartEvent
  | NextEvent
  | EnterTextEvent
  | MenuCommandEvent;

const botMachine = Machine<IBotMachineContext, BotMachineEvent>(
  {
    id: 'botMachine',
    initial: 'init',
    context: { },
    states: {
      init: {
        on: {
          START: 'invitation'
        }
      },
      invitation: {
        on: {
          '': 'registerCompany'
        },
        entry: 'sendInvitation'
      },
      registerCompany: {
        initial: 'question',
        on: {
          ENTER_TEXT: [
            {
              cond: (_, event: EnterTextEvent) => event.text === 'bmkk',
              actions: assign({ companyId: ({ companyId }, event: EnterTextEvent) => event.text }),
              target: 'registerEmployee'
            },
            {
              cond: (_, event: EnterTextEvent) => event.text !== 'bmkk',
              actions: () => console.log('Введена неверная организация')
            }
          ]
        },
        states: {
          question: {
            entry: 'askCompanyName'
          }
        },
      },
      registerEmployee: {
        initial: 'question',
        on: {
          ENTER_TEXT: [
            {
              cond: (_, event: EnterTextEvent) => event.text === '001',
              actions: assign({ employeeId: (_, event: EnterTextEvent) => event.text }),
              target: 'mainMenu'
            },
            {
              cond: (_, event: EnterTextEvent) => event.text !== '001',
              actions: () => console.log('Введен неверный персональный номер')
            }
          ]
        },
        states: {
          question: {
            entry: () => console.log('Введите персональный номер из паспорта:')
          }
        },
        exit: () => console.log('Работник успешно зарегистрирован!')
      },
      mainMenu: {
        initial: 'showMenu',
        on: {
          MENU_COMMAND: [
            {
              cond: (_, event: MenuCommandEvent) => event.command === 'payslip',
              target: 'payslip'
            },
            {
              cond: (_, event: MenuCommandEvent) => event.command === 'payslipForPeriod',
              target: 'payslipForPeriod'
            },
            {
              cond: (_, event: MenuCommandEvent) => event.command === 'logout',
              actions: () => assign({}),
              target: 'invitation'
            },
          ]
        },
        states: {
          showMenu: {
            entry: () => console.log('[ЛИСТОК][ЗА ПЕРИОД][ВЫХОД]')
          }
        }
      },
      payslip: {
        on: {
          '': 'mainMenu'
        },
        entry: () => console.log('Показываем расчетный листок на экране')
      },
      payslipForPeriod: {
        initial: 'showCalendar',
        context: {

        },
        on: {

        },
        states: {
          showCalendar: {
            entry: () => {}
          }
        }
      }
    },
  },
  {
    actions: {
      sendInvitation: () => console.log('Здравствуйте!'),
      askCompanyName: () => console.log('Введите наименование организации:')
    }
  }
);

let counter = 0;
const service = interpret(botMachine).start();

const sequence: BotMachineEvent[] = [
  { type: 'START' },
  { type: 'ENTER_TEXT', text: 'abc' },
  { type: 'ENTER_TEXT', text: 'bmkk' },
  { type: 'ENTER_TEXT', text: '002' },
  { type: 'ENTER_TEXT', text: '001' },
  { type: 'MENU_COMMAND', command: 'payslip' },
  { type: 'MENU_COMMAND', command: 'logout' },
];

for (const e of sequence) {
  console.log(`${(counter++).toString().padStart(2, '0')} State: ${service.state.toStrings().join(',')}`);
  console.log(`Input: ${JSON.stringify(e, undefined, 2)}`);
  service.send(e);
};

console.log(`Final state: ${service.state.value}`);
