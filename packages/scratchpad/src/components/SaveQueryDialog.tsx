import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TableChartIcon from '@mui/icons-material/TableChart';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { colors } from '../theme';

export type ExportMode = 'dataset' | 'query';

interface SaveQueryDialogProps {
  open: boolean;
  onClose: () => void;
  sql: string;
  datasourceId: string;
  mode: ExportMode;
}

interface AISuggestion {
  name: string;
  description: string;
}

async function getAISuggestion(sql: string, mode: ExportMode): Promise<AISuggestion> {
  const target = mode === 'dataset' ? 'a dataset' : 'an ad-hoc query';
  const prompt = `Given this SQL query, suggest a concise name (max 50 chars) and brief description (max 200 chars) for saving it as ${target}.

SQL:
${sql}

Respond in this exact JSON format only, no other text:
{"name": "suggested name here", "description": "suggested description here"}`;

  const response = await fetch('/api/models/informer-basic/_completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to get AI suggestion');
  }

  // Parse SSE stream
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text-delta' && data.delta) {
            fullText += data.delta;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }

  // Parse the accumulated text - it should contain JSON
  try {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback
  }

  return {
    name: 'Untitled Query',
    description: '',
  };
}

async function saveQuery(params: {
  name: string;
  description: string;
  sql: string;
  datasourceId: string;
}): Promise<void> {
  const response = await fetch('/api/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      language: 'sql',
      payload: params.sql,
      datasourceId: params.datasourceId,
      inputs: {},
      flow: [],
      settings: {},
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to save query' }));
    throw new Error(error.message || 'Failed to save query');
  }
}

async function saveDataset(params: {
  name: string;
  description: string;
  sql: string;
  datasourceId: string;
}): Promise<void> {
  const response = await fetch('/api/datasets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      query: {
        language: 'sql',
        payload: params.sql,
        datasourceId: params.datasourceId,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to save dataset' }));
    throw new Error(error.message || 'Failed to save dataset');
  }
}

export function SaveQueryDialog({ open, onClose, sql, datasourceId, mode }: SaveQueryDialogProps) {
  const isDataset = mode === 'dataset';
  const label = isDataset ? 'Dataset' : 'Query';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get AI suggestion when dialog opens
  useEffect(() => {
    if (open && sql) {
      setSuggesting(true);
      setError(null);
      getAISuggestion(sql, mode)
        .then((suggestion) => {
          setName(suggestion.name);
          setDescription(suggestion.description);
        })
        .catch((err) => {
          console.error('AI suggestion failed:', err);
          // Set defaults
          setName('Untitled Query');
          setDescription('');
        })
        .finally(() => {
          setSuggesting(false);
        });
    }
  }, [open, sql, mode]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    const saveFn = isDataset ? saveDataset : saveQuery;
    try {
      await saveFn({
        name: name.trim(),
        description: description.trim(),
        sql,
        datasourceId,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isDataset ? <TableChartIcon sx={{ color: colors.accent }} /> : <SaveIcon sx={{ color: colors.accent }} />}
        Save as {label}
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            {label} saved successfully!
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {suggesting && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">Getting AI suggestions...</Typography>
                <CircularProgress size={16} />
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              disabled={suggesting || loading}
              placeholder="Enter a name for this query"
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              disabled={suggesting || loading}
              placeholder="Optional description"
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />

            <Box
              sx={{
                p: 1.5,
                bgcolor: colors.surfaceHover,
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                maxHeight: 100,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                color: colors.textSecondary,
              }}
            >
              {sql}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || suggesting || success || !name.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : (isDataset ? <TableChartIcon /> : <SaveIcon />)}
        >
          {loading ? 'Saving...' : `Save ${label}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
