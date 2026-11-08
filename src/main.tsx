import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/latin-300.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource-variable/manrope/wght.css';
import './styles/index.css';
import { App } from './app/App';
import { FireworkAudio } from './audio/FireworkAudio';

// One sound player for the whole visit, created outside React.
const audio = new FireworkAudio();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App audio={audio} />
    </StrictMode>,
  );
}
