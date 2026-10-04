import styles from '@/styles/Roadwatch.module.css';
export const c = (...names: (string | false | undefined | null)[]) =>
  names
    .filter(Boolean)
    .flatMap((n) => (n as string).split(' '))
    .map((n) => styles[n] || n)
    .join(' ');
