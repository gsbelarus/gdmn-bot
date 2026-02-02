# Zarobak Bot -- Chat Bot for Telegram and Viber

1. The main purpose of Zarobak Bot is to store data about employee's payslips
   and provide easy access to them via chat interfaces like Telegram and Viber.
2. The bot allows employees to retrieve their payslips by sending commands in the chat.
3. The Enterprise Resource Planning (ERP) system generates payslips and sends them to the bot
   via a secure REST API.   
4. The bot stores the payslips in the file systems, using JSON files. 
   `src\util\fileDB.ts` contains the implementation of the file-based database.
5. All database files are defined in `src\files.ts`.   
6. For keeping track of the current state of the conversation with each user,
   the bot uses state machines implemented with the `xstate` library.
   See `src\machine.ts` for the state machine definition.   
7. The bot supports multiple languages.
8. The bot offers users some useful functions, such as:
   - Retrieving payslips for a specific month or year.
   - Aggregating payslips over a range of months or years.
   - Caalculate earnings in different currencies.
   - Display current menu of the enterprise canteen.
   - Display bulletin board with important announcements.
