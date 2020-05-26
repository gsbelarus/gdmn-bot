import { MachineConfig, assign, StateMachine } from "xstate";
import { IUpdate, Platform } from "./types";

interface ISelectedDate {
  year: number;
  month: number;
};

export interface ICalendarMachineContext {
  selectedDate: ISelectedDate;
  canceled: boolean;
  update: IUpdate | undefined;
  dateKind: 'PERIOD_1_DB' | 'PERIOD_1_DE' | 'PERIOD_2_DB';
};

type ChangeYearEvent      = { type: 'CHANGE_YEAR';    delta: number; };
type SelectMonthEvent     = { type: 'SELECT_MONTH';   month: number; };
type CancelCalendarEvent  = { type: 'CANCEL_CALENDAR' };
type RestoreEvent         = { type: 'RESTORE' };

type _CalendarMachineEvent = ChangeYearEvent | SelectMonthEvent | CancelCalendarEvent | RestoreEvent;

export type CalendarMachineEvent = _CalendarMachineEvent & { update: IUpdate };

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
      entry: 'showCalendar'
    },
    finished: {
      type: 'final',
      data: context => context
    }
  }
};

export interface IBotMachineContext {
  platform: Platform | undefined;
  companyId?: string;
  employeeId?: string;
  dateBegin: ISelectedDate;
  dateEnd: ISelectedDate;
  update: IUpdate | undefined;
};

export type StartEvent        = { type: 'START' };
export type NextEvent         = { type: 'NEXT' };
export type EnterTextEvent    = { type: 'ENTER_TEXT';    text: string; };
export type MenuCommandEvent  = { type: 'MENU_COMMAND';  command: string; };
export type DateSelectedEvent = { type: 'DATE_SELECTED'; year: number; month: number; };
export type MainMenuEvent     = { type: 'MAIN_MENU' };

type _BotMachineEvent = CalendarMachineEvent
  | StartEvent
  | NextEvent
  | EnterTextEvent
  | MenuCommandEvent
  | MainMenuEvent
  | DateSelectedEvent;

export type BotMachineEvent = _BotMachineEvent & { update?: IUpdate };

export function isEnterTextEvent(event: BotMachineEvent): event is EnterTextEvent {
  return event.type === 'ENTER_TEXT' && typeof event.text === 'string';
};

export const botMachineConfig = (calendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent>): MachineConfig<IBotMachineContext, any, BotMachineEvent> =>
  ({
    id: 'botMachine',
    initial: 'init',
    context: {
      platform: undefined,
      dateBegin: { year: 2020, month: 0 },
      dateEnd: { year: 2020, month: 11 },
      update: undefined
    },
    states: {
      init: {
        on: {
          START: {
            target: 'registerCompany',
            actions: assign({ platform: (_, { update }) => update?.platform })
          },
          MAIN_MENU: {
            target: 'mainMenu',
            actions: assign({ platform: (_, { update }) => update?.platform })
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
      payslipForPeriod: {
        initial: 'enterDateBegin',
        entry: assign({ update: (_, event: BotMachineEvent) => event.update }),
        states: {
          enterDateBegin: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext, event: BotMachineEvent) => ({
                selectedDate: ctx.dateBegin,
                canceled: false,
                update: event.update ?? ctx.update,
                dateKind: 'PERIOD_1_DB'
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
              data: (ctx: IBotMachineContext, event: BotMachineEvent) => ({
                selectedDate: ctx.dateBegin,
                canceled: false,
                update: event.update ?? ctx.update,
                dateKind: 'PERIOD_1_DE'
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
