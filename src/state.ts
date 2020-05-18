import  { assign, interpret, Machine, Interpreter, MachineConfig } from 'xstate';

interface ICalendarMachineContext {
  year: number;
  month: number;
  canceled: boolean;
};

type ChangeYearEvent      = { type: 'CHANGE_YEAR';    delta: number; };
type SelectMonthEvent     = { type: 'SELECT_MONTH';   month: number; };
type CancelCalendarEvent  = { type: 'CANCEL_CALENDAR' };

type CalendarMachineEvent = ChangeYearEvent | SelectMonthEvent | CancelCalendarEvent;

const calendarMachineConfig: MachineConfig<ICalendarMachineContext, any, CalendarMachineEvent> = {
  id: 'calendarMachine',
  initial: 'showCalendar',
  on: {
    CHANGE_YEAR: {
      target: 'showCalendar',
      actions: assign({ year: ({ year }, { delta }: ChangeYearEvent) => year + delta })
    },
    SELECT_MONTH: {
      target: 'finished',
      actions: assign({ month: (_, { month }: SelectMonthEvent ) => month })
    },
    CANCEL_CALENDAR: {
      target: 'finished',
      actions: assign({ canceled: (_) => true })
    }
  },
  states: {
    showCalendar: {
      entry: ({ year }) => console.log(`Рисуем календарь на ${year} год.`)
    },
    finished: {
      type: 'final',
      data: (context) => ({...context})
    }
  }
};

interface IBotMachineContext {
  companyId?: string;
  employeeId?: string;
  year?: number;
  month?: number;
  calendarRef?: Interpreter<ICalendarMachineContext, any, CalendarMachineEvent>;
};

type StartEvent = { type: 'START' };
type NextEvent = { type: 'NEXT' };
type EnterTextEvent = { type: 'ENTER_TEXT'; text: string; };
type MenuCommandEvent = { type: 'MENU_COMMAND'; command: string; };
type DateSelectedEvent = { type: 'DATE_SELECTED'; year: number; month: number; };
type MainMenuEvent = { type: 'MAIN_MENU' };

type BotMachineEvent = CalendarMachineEvent
  | StartEvent
  | NextEvent
  | EnterTextEvent
  | MenuCommandEvent
  | MainMenuEvent
  | DateSelectedEvent;

const botMachine = Machine<IBotMachineContext, BotMachineEvent>(
  {
    id: 'botMachine',
    initial: 'init',
    context: {
      year: 2020,
      month: 1
    },
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
              actions: assign({}),
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
        entry: () => console.log('Показываем последний расчетный листок на экране')
      },
      payslipForPeriod: {
        invoke: {
          id: 'calendarMachine',
          src: Machine<ICalendarMachineContext, CalendarMachineEvent>(calendarMachineConfig),
          autoForward: true,
          data: {
            year: ({ year }: IBotMachineContext) => year,
            month: ({ month }: IBotMachineContext) => month
          },
          onDone: [
            {
              cond: (_, event) => event.data.canceled,
              target: '#botMachine.mainMenu'
            },
            {
              cond: (_, event) => !event.data.canceled,
              target: '#botMachine.mainMenu',
              actions: [
                assign({
                  year: (_, event) => event.data.year,
                  month: (_, event) => event.data.month,
                }),
                ({ year, month }) => console.log(`Выбрана дата: ${month}.${year}`)
              ]
            }
          ]
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
  { type: 'MENU_COMMAND', command: 'payslipForPeriod' },
  { type: 'CHANGE_YEAR', delta: -1 },
  { type: 'CANCEL_CALENDAR' },
  { type: 'MENU_COMMAND', command: 'payslipForPeriod' },
  { type: 'CHANGE_YEAR', delta: -1 },
  { type: 'SELECT_MONTH', month: 2 },
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

console.log(`Final state: ${service.state.toStrings().join(',')}`);
