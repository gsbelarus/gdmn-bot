Меню столовой за один день формируется в **JSON объект** и выгружается с помощью **POST** запроса на адрес  http://zarobak.gdmn.app:8086/zarobak/v2/upload_canteenmenu. В заголовке запроса должен быть прописан параметр `Content-Type = "application/json"`.

Структура загружаемого объекта должна соответствовать интерфейсу **ICanteenMenuUpload**:
```ts
/**
 * Локализованная строка.
 */
export interface ILocString {
  /**
   * На английском языке.
   */
  en: string | null | FormatFunc;
  /**
   * На русском языке.
   */
  ru: string | null | FormatFunc;
  /**
   * На беларускай мове.
   */
  be: string | null | FormatFunc;
};

export type ICanteenMenus = ICanteenMenu[];

export interface ICanteenMenu {
  /**
   * Уникальный идентификатор меню.
   */
  id: string;
  /**
   * Наименоване меню. Например, "Меню столовой", "Меню буфета"
   */
  name: ILocString;
  /**
   * Группы и блюда.
   */
  data: ICanteenMenuData[];
};

export interface ICanteenMenuData {
  /**
   * Название группы блюд. Например, "Закуски"
   */
  group: ILocString;
  /**
   * Порядковый номер вывода группы при печати меню. Меньшие номера идут вначале.
   */
  n: number;
  /**
   * Список блюд в данной группе.
   */
  groupdata: {
    /**
     * Наименование блюда.
     */
    good: ILocString;
    /**
     * Дополнительная информация: выход, калорийность и т.п.
     */
    det: string;
    /**
     * Цена.
     */
    cost: number;
  }[];
};

/**
 * Объект, который используется при загрузке меню на сервер.
 */
export interface ICanteenMenuUpload {
  /**
   * Сейчас строго "2.0"
   */
  version: string;
  /**
   * ИД клиента.
   */
  customerId: string;
  /**
   * Меню загружается одним запросом за один день. Дата в формате "yyyy.mm.dd"
   */
  date: string;
  objData: ICanteenMenus;
};
```
Пример заполненного объекта:
```ts
{
  "version":"2.0",
  "customerId": "brl",
  "date":"2020.10.12",
  "objData":[
    {
      "id": "381681530372976645",
      "name": {
        "ru": "Столовая",
        "be": "Сталовая"
      },
      "data": [
        {
          "group": {
            "ru": "Холодные закуски"
          },
          "n": 3,
          "groupdata": [
            {
              "good": {
                "ru": "Салат \"Дружба\""
              },
              "det": "100/2",
              "cost": 0.5
            },
            {
              "good": {
                "ru": "Салат \"Мечта\""
              },
              "det": "100/2",
              "cost": 0.98
            }
          ]
        },
        {
          "group": {
            "ru": "Супы"
          },
          "n": 7,
          "groupdata": [
            {
              "good": {
                "ru": "Рассольник ленинградский"
              },
              "det": "250/15/10/2",
              "cost": 0.98
            },
            {
              "good": {
                "ru": "Суп картофельный с птицей и рисом"
              },
              "det": "250/15",
              "cost": 0.47
            }
          ]
        }
      ]
    }
  ]
}
```