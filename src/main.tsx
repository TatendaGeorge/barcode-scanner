import { render } from 'preact';
import { App } from './app';
import './styles.css';

if ('storage' in navigator && 'persist' in navigator.storage) {
  navigator.storage.persist().catch(() => {});
}

render(<App />, document.getElementById('app')!);
