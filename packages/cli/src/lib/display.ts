import Table from 'cli-table3';
import chalk from 'chalk';

export function renderTable(columns: string[], rows: Record<string, unknown>[]): string {
  const table = new Table({
    head: columns.map((col) => chalk.cyan(col)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(
      columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return chalk.dim('null');
        if (typeof value === 'boolean') return value ? chalk.green('true') : chalk.red('false');
        const str = String(value);
        return str.length > 60 ? str.slice(0, 57) + '...' : str;
      })
    );
  }

  return table.toString();
}

export function renderRecord(record: Record<string, unknown>): string {
  const table = new Table({ style: { head: [], border: [] } });
  for (const [key, value] of Object.entries(record)) {
    table.push({
      [chalk.cyan(key)]: value === null || value === undefined ? chalk.dim('null') : String(value),
    });
  }
  return table.toString();
}

export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

export function warn(message: string): void {
  console.warn(chalk.yellow('!'), message);
}

export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}
