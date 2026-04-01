import { createInterface } from 'readline';

/**
 * Ask a yes/no question in the terminal.
 * Returns true for yes, false for no.
 *
 * If stdin is not a TTY (piped, CI, npm preinstall hook),
 * returns the default value without prompting.
 */
export function confirm(question: string, defaultNo: boolean = true): Promise<boolean> {
  // Non-interactive: return default without prompting
  if (!process.stdin.isTTY) {
    return Promise.resolve(!defaultNo);
  }

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const hint = defaultNo ? '[y/N]' : '[Y/n]';

    rl.question(`${question} ${hint} `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();

      if (defaultNo) {
        // Default is No — only "y" or "yes" means yes
        resolve(normalized === 'y' || normalized === 'yes');
      } else {
        // Default is Yes — only "n" or "no" means no
        resolve(normalized !== 'n' && normalized !== 'no');
      }
    });
  });
}
