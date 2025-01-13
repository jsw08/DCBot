const COLUMNS = 3 as const;
const MINLENGTH = 4 as const

export function spreadEvenlyFields(data: string[], fieldName: string ) {
  if (data.length >= MINLENGTH) {
    return data
      .reduce<string[][]>((acc, value, index) => {
	acc[index % COLUMNS].push(value);
	return acc;
      }, Array.from({ length: COLUMNS }, () => []))
      .map((column, i) => ({
	name: i == 0 ? fieldName : "⠀",
	value: column.join("\n"),
	inline: true,
      }));
  } else {
    data.join("\n")
    return [{
      name: fieldName,
      value: data.join("\n"),
      inline: true,
    }]
  }
}
