const COPY = {
  dtoInIsNotValid: "Neplatné údaje",
  unauthorized: "Nejsi přihlášený",
  forbidden: "Nemáš oprávnění",
  userNotFound: "Uživatel neexistuje",
  eventNotFound: "Termín neexistuje",
  messageNotFound: "Zpráva neexistuje",
  emailAlreadyExists: "E-mail už existuje",
  nicknameAlreadyExists: "Přezdívka už existuje",
  lastAdmin: "Nelze odebrat posledního správce",
  capacityExceeded: "Kapacita je plná",
  eventCancelled: "Termín je zrušený",
  pushNotConfigured: "Oznámení nejsou nastavená",
  network: "Nejde se spojit se serverem",
};

export function errorCopy(code, message) {
  if (COPY[code]) {
    return COPY[code];
  }
  return message || "Něco se pokazilo";
}
