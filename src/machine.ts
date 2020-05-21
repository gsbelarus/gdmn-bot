import { MachineConfig, Machine, assign } from "xstate";
import { IUpdate } from "./types";

interface ISelectedDate {
  year: number;
  month: number;
};

interface ICalendarMachineContext {
  selectedDate: ISelectedDate;
  canceled: boolean;
};

type ChangeYearEvent      = { type: 'CHANGE_YEAR';    delta: number; };
type SelectMonthEvent     = { type: 'SELECT_MONTH';   month: number; };
type CancelCalendarEvent  = { type: 'CANCEL_CALENDAR' };
type RestoreEvent         = { type: 'RESTORE' };

type CalendarMachineEvent = ChangeYearEvent | SelectMonthEvent | CancelCalendarEvent | RestoreEvent;

const calendarMachineConfig: MachineConfig<ICalendarMachineContext, any, CalendarMachineEvent> = {
  id: 'calendarMachine',
  initial: 'showCalendar',
  on: {
    RESTORE: 'showCalendar',
    CHANGE_YEAR: {
      target: 'showCalendar',
      actions: assign({
        selectedDate: ({ selectedDate }, { delta }: ChangeYearEvent) => ({
          ...selectedDate, year: selectedDate.year + delta
        })
      })
    },
    SELECT_MONTH: {
      target: 'finished',
      actions: assign({
        selectedDate: ({ selectedDate }, { month }: SelectMonthEvent) => ({
          ...selectedDate, month
        })
      })
    },
    CANCEL_CALENDAR: {
      target: 'finished',
      actions: assign({ canceled: (_) => true })
    }
  },
  states: {
    showCalendar: {
      entry: ({ selectedDate: { year } }) => console.log(`Рисуем календарь на ${year} год.`)
    },
    finished: {
      type: 'final',
      data: context => context
    }
  }
};

export interface IBotMachineContext {
  companyId?: string;
  employeeId?: string;
  dateBegin: ISelectedDate;
  dateEnd: ISelectedDate;
};

type StartEvent        = { type: 'START' };
type NextEvent         = { type: 'NEXT' };
type EnterTextEvent    = { type: 'ENTER_TEXT';    text: string; };
type MenuCommandEvent  = { type: 'MENU_COMMAND';  command: string; };
type DateSelectedEvent = { type: 'DATE_SELECTED'; year: number; month: number; };
type MainMenuEvent     = { type: 'MAIN_MENU' };

type _BotMachineEvent = CalendarMachineEvent
  | StartEvent
  | NextEvent
  | EnterTextEvent
  | MenuCommandEvent
  | MainMenuEvent
  | DateSelectedEvent;

export type BotMachineEvent = _BotMachineEvent & { update?: IUpdate };

export const botMachineConfig: MachineConfig<IBotMachineContext, any, BotMachineEvent> =
  {
    id: 'botMachine',
    initial: 'init',
    context: {
      dateBegin: { year: 2020, month: 0 },
      dateEnd: { year: 2020, month: 11 },
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
              actions: assign({ companyId: (_, { text }: EnterTextEvent) => text }),
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
              cond: (_, { command }: MenuCommandEvent) => command === 'payslip',
              target: 'payslip'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === 'payslipForPeriod',
              target: 'payslipForPeriod'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === 'logout',
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
        initial: 'enterDateBegin',
        states: {
          enterDateBegin: {
            invoke: {
              id: 'calendarMachine',
              src: Machine(calendarMachineConfig),
              autoForward: true,
              data: {
                selectedDate: ({ dateBegin }: IBotMachineContext) => dateBegin
              },
              onDone: [
                {
                  cond: (_, event) => event.data.canceled,
                  target: '#botMachine.mainMenu'
                },
                {
                  cond: (_, event) => !event.data.canceled,
                  target: 'enterDateEnd',
                  actions: assign({ dateBegin: (_, event) => event.data.selectedDate })
                }
              ]
            }
          },
          enterDateEnd: {
            invoke: {
              id: 'calendarMachine',
              src: Machine(calendarMachineConfig),
              autoForward: true,
              data: {
                selectedDate: ({ dateEnd }: IBotMachineContext) => dateEnd
              },
              onDone: [
                {
                  cond: (_, event) => event.data.canceled,
                  target: '#botMachine.mainMenu'
                },
                {
                  cond: (_, event) => !event.data.canceled,
                  target: 'showPayslipForPeriod',
                  actions: assign({ dateEnd: (_, event) => event.data.selectedDate })
                }
              ]
            }
          },
          showPayslipForPeriod: {
            on: { '': '#botMachine.mainMenu' },
            entry: ({ dateBegin, dateEnd }) => console.log(`Show payslip for ${dateBegin.month}.${dateBegin.year}-${dateEnd.month}.${dateEnd.year}...`)
          }
        }
      }
    },
  };
