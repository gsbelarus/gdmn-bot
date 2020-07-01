import { IHourTypes } from "./types";

export const MINDATE = new Date(2018, 0, 1);
export const URLNBRBRATES = "http://www.nbrb.by/API/ExRates/Rates";
export const URLNBRBCURRENCIES = "http://www.nbrb.by/API/ExRates/Currencies";
export const hourTypes: IHourTypes = {
  0: {
    "name": {
      "ru": {
        "name": ""
      },
      "be": {
        "name": ""
      },
      "en": {
        "name": ""
      }
    }
  },
  1: {
    "name": {
      "ru": {
        "name": "Н"
      },
      "be": {
        "name": "Н"
      },
      "en": {
        "name": "N"
      }
    }
  },
  2: {
    "name": {
      "ru": {
        "name": "В"
      },
      "be": {
        "name": "В"
      },
      "en": {
        "name": "H"
      }
    }
  },
  3: {
    "name": {
      "ru": {
        "name": "В"
      },
      "be": {
        "name": "В"
      },
      "en": {
        "name": "H"
      }
    }
  },
  4: {
    "name": {
      "ru": {
        "name": "О"
      },
      "be": {
        "name": "А"
      },
      "en": {
        "name": "V"
      }
    }
  },
  5: {
    "name": {
      "ru": {
        "name": "Б"
      },
      "be": {
        "name": "Б"
      },
      "en": {
        "name": "S"
      }
    }
  },
  6: {
    "name": {
      "ru": {
        "name": "ПР"
      },
      "be": {
        "name": "ПР"
      },
      "en": {
        "name": "A"
      }
    }
  },
  7: {
    "name": {
      "ru": {
        "name": "А"
      },
      "be": {
        "name": "A"
      },
      "en": {
        "name": "L"
      }
    }
  }
}
