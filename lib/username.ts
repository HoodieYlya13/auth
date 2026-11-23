export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 30;

// Latin letters only, accented ones included: no look-alike Cyrillic or Greek letters.
export const USERNAME_CHARACTERS = /^[\p{Script=Latin}0-9_]+$/u;
