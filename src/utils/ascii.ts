export const generateTable = (columns: number, items: string[]): string => {
  columns = items.length > columns ? columns : items.length;
  const columnWidths: number[] = items.reduce(
    (reduced, current, currentIndex) => {
      const columnIndex = currentIndex % columns;
      reduced[columnIndex] = Math.max(reduced[columnIndex], current.length);
      return reduced;
    },
    new Array(columns).fill(0)
  );

  const rows: string[] = items
    .reduce<string[][]>((reduced, current, currentIndex) => {
      if (currentIndex % columns === 0) reduced.push([]);
      reduced[reduced.length - 1].push(current);
      return reduced;
    }, [])
    .map((item) => {
      const paddedRow = [...item, ...Array(columns - item.length).fill("")];
      return `║ ${paddedRow
        .map((value, index) => value.padEnd(columnWidths[index], " "))
        .join(" ║ ")} ║`;
    });

  const headFootSeparator = (begin: string, separate: string, end: string) =>
    begin +
    columnWidths.map((width) => "═".repeat(width + 2)).join(separate) +
    end;

  return [
    headFootSeparator("╔", "╦", "╗"),
    ...rows,
    headFootSeparator("╚", "╩", "╝"),
  ].join("\n");
};