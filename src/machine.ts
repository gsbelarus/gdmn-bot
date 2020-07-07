import { MachineConfig, assign, StateMachine } from "xstate";
import { Platform, IDate } from "./types";
import { Semaphore } from "./semaphore";

interface IMachineContextBase {
  platform?: Platform;
  chatId?: string;
  semaphore?: Semaphore;
}

export interface ICalendarMachineContext extends IMachineContextBase {
  selectedDate: IDate;
  canceled: boolean;
  dateKind: 'PERIOD_1_DB' | 'PERIOD_1_DE' | 'PERIOD_2_DB' | 'PERIOD_MONTH';
};

type ChangeYearEvent      = { type: 'CHANGE_YEAR';    delta: number; };
type SelectMonthEvent     = { type: 'SELECT_MONTH';   month: number; };
type CancelCalendarEvent  = { type: 'CANCEL_CALENDAR' };

export type CalendarMachineEvent = ChangeYearEvent | SelectMonthEvent | CancelCalendarEvent;

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
        })
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
  /**
   * Устанавливается в true после окончания регистрации пользователя.
   * Т.е. поле проверки названия предприятия, персонального номера
   * и, если активирована защита, после проверки ПИН кода.
   */
  verified?: boolean;
  dateBegin: IDate;
  dateEnd: IDate;
  dateBegin2: IDate;
  /**
   * ИД валюты для отображения курсов.
   */
  currencyId?: string;
  currencyDate: IDate;
  tableDate: IDate;
  scheduleDate: IDate;
  /**
   * Текст объявления.
   */
  announcement?: string;
};

export type StartEvent           = { type: 'START' } & Required<IMachineContextBase>;
export type MainMenuEvent        = { type: 'MAIN_MENU' } & Required<IMachineContextBase> & { customerId: string; employeeId: string; forceMainMenu: boolean; };
export type EnterTextEvent       = { type: 'ENTER_TEXT';  text: string; };
export type MenuCommandEvent     = { type: 'MENU_COMMAND';  command: string; };
export type SelectCurrencyEvent  = { type: 'SELECT_CURRENCY'; id: string; };

export type BotMachineEvent = CalendarMachineEvent
  | StartEvent
  | EnterTextEvent
  | MenuCommandEvent
  | MainMenuEvent
  | SelectCurrencyEvent;

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
      dateBegin2: { year: new Date().getFullYear(), month: 0 },
      currencyDate: { year: new Date().getFullYear(), month: 0 },
      tableDate: { year: new Date().getFullYear(), month: 0 },
      scheduleDate: { year: new Date().getFullYear(), month: 0 }
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
              target: '.verification'
            },
            {
              actions: 'unknownEmployee'
            }
          ]
        },
        states: {
          question: {
            entry: 'askPersonalNumber'
          },
          verification: {
            on: {
              '': [
                {
                  cond: 'isProtected',
                  target: 'checkPIN'
                },
                {
                  target: '#botMachine.mainMenu',
                  actions: assign({ verified: ({ customerId, employeeId }) => !!customerId && !!employeeId  })
                }
              ]
            }
          },
          checkPIN: {
            on: {
              ENTER_TEXT: [
                {
                  cond: 'checkPIN',
                  actions: assign({ verified: ({ customerId, employeeId }) => !!customerId && !!employeeId  }),
                  target: '#botMachine.mainMenu'
                },
                {
                  actions: 'invalidPIN'
                }
              ]
            },
            entry: 'askPIN'
          }
        },
      },
      mainMenu: {
        initial: 'showMenu',
        on: {
          MENU_COMMAND: [
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.wage',
              target: 'wage'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.other',
              target: 'other'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.settings',
              target: 'settings'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.logout',
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
      wage: {
        initial: 'showWage',
        on: {
          MENU_COMMAND: [
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.payslip',
              target: 'payslip'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.latestPayslip',
              target: 'latestPayslip'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.detailedPayslip',
              target: 'detailedPayslip'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.payslipForPeriod',
              target: 'payslipForPeriod'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.comparePayslip',
              target: 'comparePayslip'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.cancelWage',
              target: 'mainMenu'
            },
          ]
        },
        states: {
          showWage: {
            entry: 'showWage'
          }
        },
      },
      other: {
        initial: 'showOther',
        on: {
          MENU_COMMAND: [
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.cancelOther',
              target: 'mainMenu'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.birthdays',
              target: 'showBirthdays'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.billboard',
              target: 'sendAnnouncement'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.rates',
              target: 'showCurrencyRates'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.table',
              target: 'showTable'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.schedule',
              target: 'showSchedule'
            }
          ]
        },
        states: {
          showOther: {
            entry: 'showOther'
          }
        },
      },
      sendAnnouncement: {
        initial: 'enterAnnouncement',
        on: {
          MENU_COMMAND: [
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.cancelEnterAnnouncement' || command === '.cancelSendAnnouncement',
              target: '#botMachine.mainMenu'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.sendToDepartment',
              target: '#botMachine.mainMenu',
              actions: 'sendToDepartment'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.sendToEnterprise',
              target: '#botMachine.mainMenu',
              actions: 'sendToEnterprise'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.sendToAll',
              target: '#botMachine.mainMenu',
              actions: 'sendToAll'
            },
          ],
          ENTER_TEXT: {
            target: '.sendAnnouncementMenu',
            actions: assign({ announcement: (_, { text }: EnterTextEvent) => text })
          }
        },
        states: {
          enterAnnouncement: {
            entry: 'enterAnnouncementInvitation'
          },
          sendAnnouncementMenu: {
            entry: 'sendAnnouncementMenu'
          }
        }
      },
      showBirthdays: {
        on: { '': '#botMachine.mainMenu' },
        entry: 'showBirthdays'
      },
      showCurrencyRates: {
        initial: 'selectCurrency',
        on: {
          MENU_COMMAND: {
            cond: (_, { command }: MenuCommandEvent) => command === '.cancelRates',
            target: '#botMachine.mainMenu'
          },
          SELECT_CURRENCY: {
            actions: assign({ currencyId: (_, { id }: SelectCurrencyEvent) => id }),
            target: '.selectMonth'
          }
        },
        states: {
          selectCurrency: {
            entry: 'showSelectCurrencyRatesMenu'
          },
          selectMonth: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.currencyDate,
                canceled: false,
                dateKind: 'PERIOD_MONTH',
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
                  target: 'showCurrencyRatesForMonth',
                  actions: assign({
                    currencyDate: (_, event) => event.data.selectedDate
                  })
                }
              ]
            }
          },
          showCurrencyRatesForMonth: {
            on: {
              '': '#botMachine.mainMenu'
            },
            entry: 'showCurrencyRatesForMonth'
          }
        }
      },
      showTable: {
        initial: 'enterDate',
        states: {
          enterDate: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.tableDate,
                canceled: false,
                dateKind: 'PERIOD_MONTH',
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
                  target: 'showTable',
                  actions: assign({
                    tableDate: (_, event) => event.data.selectedDate,
                  })
                }
              ]
            }
          },
          showTable: {
            on: { '': '#botMachine.mainMenu' },
            entry: 'showTable'
          }
        }
      },
     showSchedule: {
        initial: 'enterDate',
        states: {
          enterDate: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.scheduleDate,
                canceled: false,
                dateKind: 'PERIOD_MONTH',
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
                  target: 'showSchedule',
                  actions: assign({
                    scheduleDate: (_, event) => event.data.selectedDate,
                  })
                }
              ]
            }
          },
          showSchedule: {
            on: { '': '#botMachine.mainMenu' },
            entry: 'showSchedule'
          }
        }
      },
      settings: {
        initial: 'showSettings',
        on: {
          MENU_COMMAND: [
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.selectLanguage',
              target: '.selectLanguage'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.selectCurrency',
              target: '.selectCurrency'
            },
            {
              cond: (_, { command }: MenuCommandEvent) => command === '.cancelSettings',
              target: 'mainMenu'
            },
          ]
        },
        states: {
          selectLanguage: {
            on: {
              MENU_COMMAND: [
                {
                  cond: (_, { command }: MenuCommandEvent) => command === '.cancelSettings',
                  target: 'showSettings'
                },
                {
                  target: 'showSettings',
                  actions: 'selectLanguage'
                }
              ]
            },
            entry: 'showSelectLanguageMenu'
          },
          selectCurrency: {
            on: {
              MENU_COMMAND: [
                {
                  cond: (_, { command }: MenuCommandEvent) => command === '.cancelSettings',
                  target: 'showSettings'
                },
                {
                  target: 'showSettings',
                  actions: 'selectCurrency'
                }
              ]
            },
            entry: 'showSelectCurrencyMenu'
          },
          showSettings: {
            entry: 'showSettings'
          },
        },
      },
      logout: {
        type: 'final',
        entry: 'logout'
      },
      latestPayslip: {
        on: {
          '': '#botMachine.mainMenu'
        },
        entry: 'showLatestPayslip'
      },
      payslip: {
        initial: 'enterDate',
        states: {
          enterDate: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.dateBegin,
                canceled: false,
                dateKind: 'PERIOD_MONTH',
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
                  target: 'showPayslip',
                  actions: assign({
                    dateBegin: (_, event) => event.data.selectedDate,
                    dateEnd: (_, event) => event.data.selectedDate
                  })
                }
              ]
            }
          },
          showPayslip: {
            on: { '': '#botMachine.mainMenu' },
            entry: 'showPayslip'
          }
        }
      },
      detailedPayslip: {
        initial: 'enterDate',
        states: {
          enterDate: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.dateBegin,
                canceled: false,
                dateKind: 'PERIOD_MONTH',
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
                  target: 'showDetailedPayslip',
                  actions: assign({
                    dateBegin: (_, event) => event.data.selectedDate,
                    dateEnd: (_, event) => event.data.selectedDate
                  })
                }
              ]
            }
          },
          showDetailedPayslip: {
            on: { '': '#botMachine.mainMenu' },
            entry: 'showDetailedPayslip'
          }
        }
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
      },
      comparePayslip: {
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
                  target: 'enterDateBegin2',
                  actions: assign({ dateEnd: (_, event) => event.data.selectedDate })
                }
              ]
            }
          },
          enterDateBegin2: {
            invoke: {
              id: 'calendarMachine',
              src: calendarMachine,
              autoForward: true,
              data: (ctx: IBotMachineContext) => ({
                selectedDate: ctx.dateBegin2,
                canceled: false,
                dateKind: 'PERIOD_2_DB',
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
                  target: 'showComparePayslip',
                  actions: assign({ dateBegin2: (_, event) => event.data.selectedDate })
                }
              ]
            }
          },
          showComparePayslip: {
            on: { '': '#botMachine.mainMenu' },
            entry: 'showComparePayslip'
          }
        }
      }
    }
  });
