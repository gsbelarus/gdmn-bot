# Zarobak Bot State Flow Diagram

This document describes the navigation flow and state transitions in the Zarobak Bot using Mermaid diagrams.

## Overview

The bot uses XState library to manage conversation state. There are two main state machines:
1. **Bot Machine** - Main state machine handling user registration, menu navigation, and features
2. **Calendar Machine** - Sub-machine for date selection (invoked by various features)

---

## Main Bot State Machine

```mermaid
stateDiagram-v2
    [*] --> init

    %% Initial state transitions
    init --> registerCompany : START
    init --> mainMenu : MAIN_MENU (registered user)

    %% Registration flow
    state registerCompany {
        [*] --> askCompanyName
        askCompanyName --> askCompanyName : ENTER_TEXT [company not found]
    }
    registerCompany --> registerEmployee : ENTER_TEXT [company found]

    state registerEmployee {
        [*] --> askPersonalNumber
        askPersonalNumber --> askPersonalNumber : ENTER_TEXT [employee not found]
        askPersonalNumber --> verification : ENTER_TEXT [employee found]
        
        verification --> checkPIN : [isProtected]
        verification --> mainMenu : [not protected]
        
        checkPIN --> checkPIN : ENTER_TEXT [invalid PIN]
        checkPIN --> mainMenu : ENTER_TEXT [valid PIN]
    }

    %% Main Menu
    state mainMenu {
        [*] --> showMenu
    }
    mainMenu --> wage : .wage
    mainMenu --> other : .other
    mainMenu --> settings : .settings
    mainMenu --> logout : .logout

    %% Wage submenu
    state wage {
        [*] --> showWageMenu
    }
    wage --> payslip : .payslip
    wage --> latestPayslip : .latestPayslip
    wage --> detailedPayslip : .detailedPayslip
    wage --> payslipForPeriod : .payslipForPeriod
    wage --> comparePayslip : .comparePayslip
    wage --> mainMenu : .cancelWage

    %% Payslip flows
    state payslip {
        [*] --> ps_enterDate
        ps_enterDate --> ps_showPayslip : SELECT_MONTH
        ps_enterDate --> mainMenu : CANCEL_CALENDAR
    }
    payslip --> mainMenu : [auto]

    latestPayslip --> mainMenu : [auto]

    state detailedPayslip {
        [*] --> dp_enterDate
        dp_enterDate --> dp_showDetailedPayslip : SELECT_MONTH
        dp_enterDate --> mainMenu : CANCEL_CALENDAR
    }
    detailedPayslip --> mainMenu : [auto]

    state payslipForPeriod {
        [*] --> pfp_enterDateBegin
        pfp_enterDateBegin --> pfp_enterDateEnd : SELECT_MONTH
        pfp_enterDateBegin --> mainMenu : CANCEL_CALENDAR
        pfp_enterDateEnd --> pfp_showPayslip : SELECT_MONTH
        pfp_enterDateEnd --> mainMenu : CANCEL_CALENDAR
    }
    payslipForPeriod --> mainMenu : [auto]

    state comparePayslip {
        [*] --> cp_enterDateBegin
        cp_enterDateBegin --> cp_enterDateEnd : SELECT_MONTH
        cp_enterDateBegin --> mainMenu : CANCEL_CALENDAR
        cp_enterDateEnd --> cp_enterDateBegin2 : SELECT_MONTH
        cp_enterDateEnd --> mainMenu : CANCEL_CALENDAR
        cp_enterDateBegin2 --> cp_showCompare : SELECT_MONTH
        cp_enterDateBegin2 --> mainMenu : CANCEL_CALENDAR
    }
    comparePayslip --> mainMenu : [auto]

    %% Other submenu
    state other {
        [*] --> showOtherMenu
    }
    other --> mainMenu : .cancelOther
    other --> showBirthdays : .birthdays
    other --> sendAnnouncement : .billboard
    other --> showCurrencyRates : .rates
    other --> showTable : .table
    other --> showSchedule : .schedule
    other --> showCanteenMenu : .canteenmenu

    showBirthdays --> mainMenu : [auto]

    state showCanteenMenu {
        [*] --> cm_checkData
        cm_checkData --> cm_selectMenu : [hasData]
        cm_checkData --> cm_noData : [noData]
        cm_noData --> mainMenu : [auto]
        cm_selectMenu --> cm_showText : SELECT_CANTEEN_MENU
    }
    showCanteenMenu --> mainMenu : .cancelSettings
    showCanteenMenu --> mainMenu : [auto after display]

    state showCurrencyRates {
        [*] --> cr_selectCurrency
        cr_selectCurrency --> cr_selectMonth : SELECT_CURRENCY
        cr_selectMonth --> cr_showRates : SELECT_MONTH
        cr_selectMonth --> mainMenu : CANCEL_CALENDAR
    }
    showCurrencyRates --> mainMenu : .cancelRates
    showCurrencyRates --> mainMenu : [auto after display]

    state showTable {
        [*] --> tbl_enterDate
        tbl_enterDate --> tbl_showTable : SELECT_MONTH
        tbl_enterDate --> mainMenu : CANCEL_CALENDAR
    }
    showTable --> mainMenu : [auto]

    state showSchedule {
        [*] --> sch_enterDate
        sch_enterDate --> sch_showSchedule : SELECT_MONTH
        sch_enterDate --> mainMenu : CANCEL_CALENDAR
    }
    showSchedule --> mainMenu : [auto]

    state sendAnnouncement {
        [*] --> ann_enterText
        ann_enterText --> ann_sendMenu : ENTER_TEXT
        ann_sendMenu --> ann_confirm : .sendToDepartment / .sendToEnterprise / .sendToAll
        ann_confirm --> ann_sending : .confirmSending
        ann_confirm --> mainMenu : .cancelSending
        ann_sending --> mainMenu : [auto]
    }
    sendAnnouncement --> mainMenu : .cancelEnterAnnouncement
    sendAnnouncement --> mainMenu : .cancelSendAnnouncement

    %% Settings submenu
    state settings {
        [*] --> showSettingsMenu
        showSettingsMenu --> selectLanguage : .selectLanguage
        showSettingsMenu --> selectCurrency : .selectCurrency
        selectLanguage --> showSettingsMenu : [language selected]
        selectLanguage --> showSettingsMenu : .cancelSettings
        selectCurrency --> showSettingsMenu : [currency selected]
        selectCurrency --> showSettingsMenu : .cancelSettings
    }
    settings --> mainMenu : .cancelSettings

    %% Logout
    state logout {
        [*] --> showLogoutMessage
        showLogoutMessage --> confirmedLogout : .confirmLogout
    }
    logout --> mainMenu : .cancelLogout
    confirmedLogout --> [*]
```

---

## Calendar Sub-Machine

The calendar machine is invoked for date selection in various features (payslips, timesheets, schedules, currency rates).

```mermaid
stateDiagram-v2
    [*] --> showCalendar
    
    showCalendar --> showCalendar : CHANGE_YEAR (±1)
    showCalendar --> showSelectedDate : SELECT_MONTH
    showCalendar --> finished : CANCEL_CALENDAR
    
    showSelectedDate --> finished : [auto]
    
    finished --> [*]
    
    note right of showCalendar
        Displays year selector
        and month buttons
    end note
    
    note right of finished
        Returns: selectedDate, canceled
    end note
```

---

## Menu Structure

### Main Menu
```mermaid
flowchart TD
    MainMenu[Main Menu]
    MainMenu --> Wage[💰 Wage]
    MainMenu --> Other[📋 Other]
    MainMenu --> Settings[⚙️ Settings]
    MainMenu --> Logout[🚪 Logout]
    MainMenu --> Help[❓ Help - External Link]
```

### Wage Submenu
```mermaid
flowchart TD
    Wage[💰 Wage Menu]
    Wage --> Payslip[📄 Payslip - Single Month]
    Wage --> DetailedPayslip[📑 Detailed Payslip]
    Wage --> PayslipForPeriod[📅 Payslip for Period]
    Wage --> ComparePayslip[⚖️ Compare Payslips]
    Wage --> Back[⬅️ Back to Main Menu]
    
    Payslip --> CalendarMonth[Select Month]
    DetailedPayslip --> CalendarMonth2[Select Month]
    PayslipForPeriod --> CalendarDB[Select Start Month]
    CalendarDB --> CalendarDE[Select End Month]
    ComparePayslip --> CalendarDB1[Select Period 1 Start]
    CalendarDB1 --> CalendarDE1[Select Period 1 End]
    CalendarDE1 --> CalendarDB2[Select Period 2 Start]
```

### Other Submenu
```mermaid
flowchart TD
    Other[📋 Other Menu]
    Other --> Schedule[📅 Work Schedule]
    Other --> Table[📊 Timesheet]
    Other --> Birthdays[🎂 Birthdays]
    Other --> Rates[💱 Currency Rates]
    Other --> CanteenMenu[🍽️ Canteen Menu]
    Other --> Billboard[📢 Bulletin Board]
    Other --> Back[⬅️ Back to Main Menu]
    
    Schedule --> CalMonth1[Select Month]
    Table --> CalMonth2[Select Month]
    Rates --> SelectCurrency[Select Currency]
    SelectCurrency --> CalMonth3[Select Month]
    CanteenMenu --> SelectMenu[Select Menu Type]
    Billboard --> EnterText[Enter Announcement]
    EnterText --> SelectRecipient[Select Recipients]
    SelectRecipient --> Confirm[Confirm Sending]
```

### Settings Submenu
```mermaid
flowchart TD
    Settings[⚙️ Settings Menu]
    Settings --> Language[🌐 Select Language]
    Settings --> Currency[💵 Select Display Currency]
    Settings --> Back[⬅️ Back to Main Menu]
    
    Language --> BE[🇧🇾 Беларуская]
    Language --> RU[🇷🇺 Русский]
    Language --> EN[🇬🇧 English]
    
    Currency --> BYN[BYN - Belarusian Ruble]
    Currency --> USD[USD - US Dollar]
    Currency --> EUR[EUR - Euro]
    Currency --> RUB[RUB - Russian Ruble]
    Currency --> PLN[PLN - Polish Zloty]
    Currency --> UAH[UAH - Ukrainian Hryvnia]
```

### Logout Flow
```mermaid
flowchart TD
    Logout[🚪 Logout]
    Logout --> Confirm{Confirm Logout?}
    Confirm -->|Yes| Unlink[Unlink Account]
    Confirm -->|No| MainMenu[Back to Main Menu]
    Unlink --> Registration[Start Registration]
```

---

## Registration Flow

```mermaid
sequenceDiagram
    participant User
    participant Bot
    participant DB as File Database

    User->>Bot: /start or first message
    Bot->>User: Ask company name
    User->>Bot: Enter company name
    Bot->>DB: Search for company
    
    alt Company not found
        Bot->>User: Unknown company, list available companies
        User->>Bot: Enter company name again
    else Company found
        Bot->>User: Ask personal ID number
        User->>Bot: Enter passport ID
        Bot->>DB: Search for employee
        
        alt Employee not found
            Bot->>User: Unknown employee, try again
            User->>Bot: Enter passport ID again
        else Employee found
            alt Company requires PIN verification
                Bot->>User: Ask PIN code from payslip
                User->>Bot: Enter PIN
                
                alt Invalid PIN
                    Bot->>User: Invalid PIN, try again
                    User->>Bot: Enter PIN again
                else Valid PIN
                    Bot->>DB: Link chat to employee account
                    Bot->>User: Show main menu
                end
            else No PIN required
                Bot->>DB: Link chat to employee account
                Bot->>User: Show main menu
            end
        end
    end
```

---

## User Rights and Menu Visibility

Some menu items are conditionally displayed based on user rights:

| Menu Item | Required Right | Default |
|-----------|---------------|---------|
| Work Schedule | `SCHEDULE` | Allowed |
| Timesheet | `TABLE` | Allowed |
| Birthdays | `BIRTHDAYS` | Allowed |
| Canteen Menu | `CANTEEN_MENU` | Allowed |
| Send to Department | `ANN_DEPT` (write) | Allowed |
| Send to Enterprise | `ANN_ENT` (write) | Denied |
| Send to All | `ANN_GLOBAL` (write) | Denied |

---

## Commands Reference

| Command | Description | Transition |
|---------|-------------|------------|
| `.wage` | Open wage submenu | mainMenu → wage |
| `.other` | Open other features submenu | mainMenu → other |
| `.settings` | Open settings submenu | mainMenu → settings |
| `.logout` | Start logout process | mainMenu → logout |
| `.payslip` | Show payslip for month | wage → payslip |
| `.detailedPayslip` | Show detailed payslip | wage → detailedPayslip |
| `.payslipForPeriod` | Show payslip for date range | wage → payslipForPeriod |
| `.comparePayslip` | Compare two periods | wage → comparePayslip |
| `.latestPayslip` | Show latest payslip | wage → latestPayslip |
| `.cancelWage` | Back to main menu | wage → mainMenu |
| `.birthdays` | Show today's birthdays | other → showBirthdays |
| `.billboard` | Send announcement | other → sendAnnouncement |
| `.rates` | Show currency rates | other → showCurrencyRates |
| `.table` | Show timesheet | other → showTable |
| `.schedule` | Show work schedule | other → showSchedule |
| `.canteenmenu` | Show canteen menu | other → showCanteenMenu |
| `.cancelOther` | Back to main menu | other → mainMenu |
| `.selectLanguage` | Change interface language | settings → selectLanguage |
| `.selectCurrency` | Change display currency | settings → selectCurrency |
| `.cancelSettings` | Back to main/settings menu | settings → mainMenu |
| `.confirmLogout` | Confirm account unlink | logout → confirmedLogout |
| `.cancelLogout` | Cancel logout | logout → mainMenu |
