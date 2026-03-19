import { useState } from 'react';
import { Box, IconButton, Menu, MenuItem, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import { colors } from '../theme';
import type { Scratch } from '../hooks/useLocalStorage';

interface ScratchTabsProps {
  scratches: Scratch[];
  activeScratchId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (scratch: Scratch) => void;
}

export function ScratchTabs({
  scratches,
  activeScratchId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
}: ScratchTabsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; scratch: Scratch } | null>(null);

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

  const handleContextMenu = (e: React.MouseEvent, scratch: Scratch) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, scratch });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderBottom: `1px solid ${colors.border}`,
        bgcolor: colors.surfaceHover,
        overflowX: 'auto',
        minHeight: 36,
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: colors.border, borderRadius: 2 },
      }}
    >
      {/* Unsaved tab */}
      <Tooltip title="Unsaved scratch">
        <Box
          onClick={() => onSelect(null)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: activeScratchId === null ? colors.surface : 'transparent',
            border: activeScratchId === null ? `1px solid ${colors.border}` : '1px solid transparent',
            '&:hover': { bgcolor: activeScratchId === null ? colors.surface : `${colors.accent}10` },
          }}
        >
          <DescriptionIcon sx={{ fontSize: 14, color: colors.textSecondary }} />
          <Box component="span" sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
            Scratch
          </Box>
        </Box>
      </Tooltip>

      {/* Saved scratches */}
      {scratches.map((scratch) => (
        <Box
          key={scratch.id}
          onClick={() => onSelect(scratch.id)}
          onContextMenu={(e) => handleContextMenu(e, scratch)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            pl: 1.5,
            pr: 0.5,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: scratch.id === activeScratchId ? colors.surface : 'transparent',
            border: scratch.id === activeScratchId ? `1px solid ${colors.border}` : '1px solid transparent',
            '&:hover': { bgcolor: scratch.id === activeScratchId ? colors.surface : `${colors.accent}10` },
            maxWidth: 180,
          }}
        >
          {editingId === scratch.id ? (
            <TextField
              autoFocus
              size="small"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setEditingId(null);
                  setEditName('');
                }
              }}
              onBlur={handleRename}
              onClick={(e) => e.stopPropagation()}
              sx={{
                '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.25, px: 0.5 },
                width: 100,
              }}
            />
          ) : (
            <>
              <Box
                component="span"
                sx={{
                  fontSize: '0.75rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {scratch.name}
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(scratch.id);
                }}
                sx={{
                  p: 0.25,
                  opacity: 0.5,
                  '&:hover': { opacity: 1, bgcolor: `${colors.error}20` },
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </>
          )}
        </Box>
      ))}

      {/* New scratch input or button */}
      {isCreating ? (
        <TextField
          autoFocus
          size="small"
          placeholder="Name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') {
              setIsCreating(false);
              setNewName('');
            }
          }}
          onBlur={() => {
            if (!newName.trim()) setIsCreating(false);
          }}
          sx={{
            '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.25, px: 0.5 },
            width: 100,
          }}
        />
      ) : (
        <Tooltip title="Save as new scratch">
          <IconButton
            size="small"
            onClick={() => setIsCreating(true)}
            sx={{ p: 0.5, color: colors.textSecondary }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              setEditingId(contextMenu.scratch.id);
              setEditName(contextMenu.scratch.name);
            }
            handleCloseContextMenu();
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              onDuplicate(contextMenu.scratch);
            }
            handleCloseContextMenu();
          }}
        >
          Duplicate
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              onDelete(contextMenu.scratch.id);
            }
            handleCloseContextMenu();
          }}
          sx={{ color: colors.error }}
        >
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
