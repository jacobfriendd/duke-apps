import { useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  TextField,
  Menu,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DescriptionIcon from '@mui/icons-material/Description';
import { colors } from '../theme';
import type { Scratch } from '../hooks/useLocalStorage';

interface ScratchesListProps {
  scratches: Scratch[];
  activeScratchId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (scratch: Scratch) => void;
}

export function ScratchesList({
  scratches,
  activeScratchId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
}: ScratchesListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuScratchId, setMenuScratchId] = useState<string | null>(null);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, scratchId: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuScratchId(scratchId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuScratchId(null);
  };

  const menuScratch = scratches.find(s => s.id === menuScratchId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.border}`,
          bgcolor: colors.surfaceHover,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Scratches
        </Typography>
        <IconButton
          size="small"
          onClick={() => setIsCreating(true)}
          sx={{ color: colors.textSecondary }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* New scratch input */}
      {isCreating && (
        <Box sx={{ p: 1, borderBottom: `1px solid ${colors.border}` }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Scratch name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewName('');
              }
            }}
            onBlur={() => {
              if (!newName.trim()) {
                setIsCreating(false);
              }
            }}
          />
        </Box>
      )}

      {/* Scratches list */}
      <List dense sx={{ flex: 1, overflow: 'auto', py: 0 }}>
        {scratches.length === 0 && !isCreating && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No scratches yet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click + to create one
            </Typography>
          </Box>
        )}
        {scratches.map(scratch => (
          <ListItemButton
            key={scratch.id}
            selected={scratch.id === activeScratchId}
            onClick={() => onSelect(scratch.id)}
            sx={{
              py: 0.75,
              '&.Mui-selected': {
                bgcolor: `${colors.accent}15`,
                borderLeft: `3px solid ${colors.accent}`,
                '&:hover': {
                  bgcolor: `${colors.accent}20`,
                },
              },
            }}
          >
            <DescriptionIcon
              sx={{ fontSize: 18, mr: 1, color: colors.textSecondary }}
            />
            {editingId === scratch.id ? (
              <TextField
                autoFocus
                size="small"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={handleRename}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                sx={{ flex: 1 }}
              />
            ) : (
              <ListItemText
                primary={scratch.name}
                primaryTypographyProps={{
                  noWrap: true,
                  sx: { fontSize: '0.875rem' },
                }}
                secondary={new Date(scratch.updatedAt).toLocaleDateString()}
                secondaryTypographyProps={{
                  sx: { fontSize: '0.7rem' },
                }}
              />
            )}
            <IconButton
              size="small"
              onClick={e => handleMenuOpen(e, scratch.id)}
              sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
      </List>

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (menuScratch) {
              setEditingId(menuScratch.id);
              setEditName(menuScratch.name);
            }
            handleMenuClose();
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuScratch) {
              onDuplicate(menuScratch);
            }
            handleMenuClose();
          }}
        >
          Duplicate
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuScratchId) {
              onDelete(menuScratchId);
            }
            handleMenuClose();
          }}
          sx={{ color: colors.error }}
        >
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
