import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import { SqlScratchpad } from './components/SqlScratchpad';

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SqlScratchpad />
    </ThemeProvider>
  );
}
