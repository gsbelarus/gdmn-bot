import { MachineConfig, assign, StateMachine } from "xstate";
import { Platform } from "./types";
import { Semaphore } from "./semaphore";

interface IMachineContextBase {
  platform?: Platform;
  chatId?: string;
  semaphore?: Semaphore;
}

interface ISelectedDate {
  year: number;
  month: number;
};

export interface ICalendarMachineContext extends IMachineContextBase {
  selectedDate: ISelectedDate;
  canceled: boolean;
  dateKind: 'PERIOD_1_DB' | 'PERIOD_1_DE' | 'PERIOD_2_DB';
};

type ChangeYearEvent      = { type: 'CHANGE_YEAR';    delta: number; };
type SelectMonthEvent     = { type: 'SELECT_MONTH';   month: number; };
type CancelCalendarEvent  = { type: 'CANCEL_CALENDAR' };
type RestoreEvent         = { type: 'RESTORE' };

export type CalendarMachineEvent = ChangeYearEvent | SelectMonthEvent | CancelCalendarEvent | RestoreEvent;

export const calendarMachineConfig: MachineConfig<ICalendarMachineContext, any, CalendarMachineEvent> = {
  id: 'calendarMachine',
  initial: 'showCalendar',
  on: {
    CHANGE_YEAR: {
      target: 'showCalendar',
      actions: [
        assign({
          selectedDate: ({ selectedDate }, { delta }: ChangeYearEvent) => ({
            ...selectedDate, year: selectedDate.year + delta
          })
        }),
        'showCalendar'
      ]
    },
    SELECT_MONTH: {
      target: 'showSelectedDate',
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
      entry: 'showCalendar'
    },
    showSelectedDate: {
      on: { '': 'finished' },
      entry: 'showSelectedDate'
    },
    finished: {
      type: 'final',
      data: context => context,
    }
  }
};

export interface IBotMachineContext extends IMachineContextBase {
  customerId?: string;
  employeeId?: string;
  dateBegin: ISelectedDate;
  dateEnd: ISelectedDate;
};

export type StartEvent        = { type: 'START' } & Required<IMachineContextBase>;
export type MainMenuEvent     = { type: 'MAIN_MENU' } & Required<IMachineContextBase> & { customerId: string; employeeId: string; };
export type NextEvent         = { type: 'NEXT' };
export type EnterTextEvent    = { type: 'ENTER_TEXT';    text: string; };
export type MenuCommandEvent  = { type: 'MENU_COMMAND';  command: string; };
export type DateSelectedEvent = { type: 'DATE_SELECTED'; year: number; month: number; };

export type BotMachineEvent = CalendarMachineEvent
  | StartEvent
  | NextEvent
  | EnterTextEvent
  | MenuCommandEvent
  | MainMenuEvent
  | DateSelectedEvent;

export function isEnterTextEvent(event: BotMachineEvent): event is EnterTextEvent {
  return event.type === 'ENTER_TEXT' && typeof event.text === 'string';
};

export const botMachineConfig = (calendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent>): MachineConfig<IBotMachineContext, any, BotMachineEvent> =>
  ({
    id: 'botMachine',
    initial: 'init',
    context: {
      dateBegin: { year: new Date().getFullYear(), month: 0 },
      dateEnd: { year: new Date().getFullYear(), month: 11 },
    },
    states: {
      init: {
        on: {
          START: {
            target: 'registerCompany',
            actions: assign({
              platform: (_, { platform }: StartEvent) => platform,
              chatId: (_, { chatId }: StartEvent) => chatId,
              semaphore: (_, { semaphore }: StartEvent) => semaphore
            })
          },
          MAIN_MENU: {
            target: 'mainMenu',
            actions: assign({
              platform: (_, { platform }: MainMenuEvent) => platform,
              chatId: (_, { chatId }: MainMenuEvent) => chatId,
              customerId: (_, { customerId }: MainMenuEvent) => customerId,
              employeeId: (_, { employeeId }: MainMenuEvent) => employeeId,
              semaphore: (_, { semaphore }: MainMenuEvent) => semaphore
            })
          }
        }
      },
      registerCompany: {
        initial: 'question',
        on: {
          ENTER_TEXT: [
            {
              cond: 'findCompany',
              actions: 'assignCompanyId',
              target: 'registerEmployee'
            },
            {
              actions: 'unknownCompanyName'
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
              cond: 'findEmployee',
              actions: 'assignEmployeeId',
              target: 'mainMenu'
            },
            {
              actions: 'unknownEmployee'
            }
          ]
        },
        states: {
          question: {
            entry: 'askPersonalNumber'
          }
        },
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
              target: 'logout'
            }
          ]
        },
        states: {
          showMenu: {
            entry: 'showMainMenu'
          }
        }
      },
      payslip: {
        on: {
          '': 'mainMenu'
        },
        entry: 'showPayslip'
      },
      logout: {
        type: 'final',
        entry: 'sayGoodbye'
      },
      payslipForPeriod: {
        initial: 'enterDateBegin',
        states: {
          enterDateBegin: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.dateBegin,
                canceled: false,
                dateKind: 'PERIOD_1_DB',
                platform: ctx.platform,
                chatId: ctx.chatId,
                semaphore: ctx.semaphore
              }),
              onDone: [
                {
                  cond: (_, event) => event.data.canceled,
                  target: '#botMachine.mainMenu'
                },
                {
                  target: 'enterDateEnd',
                  actions: assign({ dateBegin: (_, event) => event.data.selectedDate })
                }
              ]
            }
          },
          enterDateEnd: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.dateBegin,
                canceled: false,
                dateKind: 'PERIOD_1_DE',
                platform: ctx.platform,
                chatId: ctx.chatId,
                semaphore: ctx.semaphore
              }),
              onDone: [
                {
                  cond: (_, event) => event.data.canceled,
                  target: '#botMachine.mainMenu'
                },
                {
                  target: 'showPayslipForPeriod',
                  actions: assign({ dateEnd: (_, event) => event.data.selectedDate })
                }
              ]
            }
          },
          showPayslipForPeriod: {
            on: { '': '#botMachine.mainMenu' },
            entry: 'showPayslipForPeriod'
          }
        }
      }
    },
  });
