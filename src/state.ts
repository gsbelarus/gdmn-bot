import  { assign, interpret, Machine, send } from 'xstate';

interface IBotMachineContext {
  companyId?: string;
  employeeId?: string;
};

type StartEvent = { type: 'START' };
type NextEvent = { type: 'NEXT' };
type EnterTextEvent = { type: 'ENTER_TEXT'; text: string; };
type SetCompanyIdEvent = { type: 'SET_COMPANY_ID'; id: string; };
type SetEmployeeIdEvent = { type: 'SET_EMPLOYEE_ID'; id: string; };
type InvalidCompanyNameEvent = { type: 'INVALID_COMPANY_NAME' };
type InvalidEmployeeIDEvent = { type: 'INVALID_EMPLOYEE_ID' };

type BotMachineEvent = StartEvent
  | NextEvent
  | EnterTextEvent
  | SetCompanyIdEvent
  | SetEmployeeIdEvent
  | InvalidCompanyNameEvent
  | InvalidEmployeeIDEvent;

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
        on: {
          ENTER_TEXT: { actions: 'testCompanyName' },
          SET_COMPANY_ID: { target: 'registerEmployee', actions: 'setCompanyId' },
          INVALID_COMPANY_NAME: 'invalidCompany'
        },
        entry: 'askCompanyName'
      },
      invalidCompany: {
        on: {
          '': 'registerCompany'
        },
        entry: () => console.log('Неверное название компании')
      },
      registerEmployee: {
        on: {
          ENTER_TEXT: { actions: 'testEmployeeId' },
          SET_EMPLOYEE_ID: { target: 'registered', actions: 'setEmployeeId' },
          INVALID_EMPLOYEE_ID: 'invalidEmployee'
        },
        entry: () => console.log('Введите персональный номер из паспорта:')
      },
      invalidEmployee: {
        on: {
          '': 'registerEmployee'
        },
        entry: () => console.log('Был введен неверный персональный номер сотрудника')
      },
      registered: {
        type: 'final',
        entry: () => console.log('Работник успешно зарегистрирован!')
      }
    },
  },
  {
    actions: {
      sendInvitation: () => console.log('Здравствуйте!'),
      askCompanyName: () => console.log('Введите наименование организации:'),
      testCompanyName: send (
        (_, event) => {
          if (event.type === 'ENTER_TEXT') {
            if (event.text === 'bmkk') {
              return {
                type: 'SET_COMPANY_ID',
                id: 'bmkk'
              }
            }
          }

          return {
            type: 'INVALID_COMPANY_NAME'
          };
        }
      ),
      testEmployeeId: send (
        (_, event) => {
          if (event.type === 'ENTER_TEXT') {
            if (event.text === '001') {
              return {
                type: 'SET_EMPLOYEE_ID',
                id: '001'
              }
            }
          }

          return {
            type: 'INVALID_EMPLOYEE_ID'
          };
        }
      ),
      setCompanyId: assign({
        companyId: ({ companyId }, event) => event.type === 'SET_COMPANY_ID' ? event.id : companyId
      }),
      setEmployeeId: assign({
        employeeId: ({ employeeId }, event) => event.type === 'SET_EMPLOYEE_ID' ? event.id : employeeId
      })
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
  { type: 'ENTER_TEXT', text: '001' }
];

for (const e of sequence) {
  console.log(`${(counter++).toString().padStart(2, '0')} State: ${service.state.value}`);
  console.log(`Input: ${JSON.stringify(e, undefined, 2)}`);
  service.send(e);
};

console.log(`Final state: ${service.state.value}`);
