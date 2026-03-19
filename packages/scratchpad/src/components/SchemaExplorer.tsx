import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Collapse,
  CircularProgress,
  TextField,
  InputAdornment,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Mapping, Field } from '../types';
import type { TableFields } from '../hooks/useSchemaFields';
import { useMappings } from '../hooks/useMappings';
import { useFields } from '../hooks/useFields';
import { colors } from '../theme';

// Compact type badge instead of heavy MUI icons
function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '3px',
        fontSize: '0.6rem',
        fontWeight: 700,
        fontFamily: 'monospace',
        color,
        bgcolor: `${color}14`,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {label}
    </Box>
  );
}

function getTypeBadge(field: Field) {
  const type = (field.dataType || '').toLowerCase();

  if (field.isPk) return <TypeBadge label="PK" color="#d97706" />;
  if (field.isFk) return <TypeBadge label="FK" color={colors.accent} />;

  if (type.includes('char') || type.includes('text') || type.includes('string'))
    return <TypeBadge label="Aa" color="#10b981" />;

  if (type.includes('int') || type.includes('decimal') || type.includes('numeric') ||
      type.includes('float') || type.includes('double') || type.includes('number') ||
      type.includes('bigint') || type.includes('smallint') || type.includes('real'))
    return <TypeBadge label="#" color="#3b82f6" />;

  if (type.includes('date') || type.includes('time') || type.includes('timestamp'))
    return <TypeBadge label="DT" color="#f59e0b" />;

  if (type.includes('bool') || type.includes('bit'))
    return <TypeBadge label="01" color="#8b5cf6" />;

  if (type.includes('json') || type.includes('object') || type.includes('array'))
    return <TypeBadge label="{}" color="#ec4899" />;

  return <TypeBadge label="?" color={colors.textSecondary} />;
}

interface SchemaExplorerProps {
  datasourceId: string | null;
  onInsertText: (text: string) => void;
  onPreviewTable?: (sql: string) => void;
  onFieldsLoaded?: (entry: TableFields) => void;
}

function FieldList({
  datasourceId,
  mapping,
  onInsertText,
  onFieldsLoaded,
}: {
  datasourceId: string;
  mapping: Mapping;
  onInsertText: (text: string) => void;
  onFieldsLoaded?: (entry: TableFields) => void;
}) {
  const { fields, loading } = useFields(datasourceId, mapping);

  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!loading && fields.length > 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      onFieldsLoaded?.({ mapping, fields });
    }
  }, [loading, fields, mapping, onFieldsLoaded]);

  if (loading) {
    return (
      <Box sx={{ pl: 4, py: 0.75 }}>
        <CircularProgress size={12} />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 0.25 }}>
      {fields.map((field) => (
        <Tooltip
          key={field.id}
          title={field.rawType || field.dataType}
          placement="right"
          arrow
          enterDelay={400}
        >
          <Box
            onClick={() => onInsertText(field.fieldId || field.name)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              pl: 4,
              pr: 1,
              py: '3px',
              cursor: 'pointer',
              '&:hover': { bgcolor: colors.surfaceHover },
            }}
          >
            {getTypeBadge(field)}
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                fontSize: '0.7rem',
                color: colors.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              {field.fieldId || field.name}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

function MappingItem({
  datasourceId,
  mapping,
  expanded,
  onToggle,
  onInsertText,
  onPreviewTable,
  onFieldsLoaded,
}: {
  datasourceId: string;
  mapping: Mapping;
  expanded: boolean;
  onToggle: () => void;
  onInsertText: (text: string) => void;
  onPreviewTable?: (sql: string) => void;
  onFieldsLoaded?: (entry: TableFields) => void;
}) {
  return (
    <>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: '5px',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: colors.surfaceHover },
          '&:hover .preview-btn': { opacity: 0.5 },
        }}
      >
        <ChevronRightIcon
          sx={{
            fontSize: 16,
            color: colors.textSecondary,
            transition: 'transform 150ms',
            transform: expanded ? 'rotate(90deg)' : 'none',
            flexShrink: 0,
          }}
        />
        <Box
          component="span"
          sx={{
            width: 18,
            height: 18,
            borderRadius: '3px',
            bgcolor: `${colors.accent}18`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: '2px',
              border: `1.5px solid ${colors.accent}`,
              opacity: 0.7,
            }}
          />
        </Box>
        <Typography
          onDoubleClick={(e) => {
            e.stopPropagation();
            onInsertText(mapping.mappingId);
          }}
          sx={{
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
            lineHeight: 1.3,
          }}
        >
          {mapping.mappingId}
        </Typography>
        <IconButton
          className="preview-btn"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onPreviewTable?.(`SELECT * FROM ${mapping.mappingId} LIMIT 100;`);
          }}
          sx={{
            p: 0.25,
            opacity: 0,
            '&:hover': { opacity: '1 !important', color: colors.success },
          }}
        >
          <PlayArrowIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <Collapse in={expanded} timeout={150} unmountOnExit>
        <FieldList
          datasourceId={datasourceId}
          mapping={mapping}
          onInsertText={onInsertText}
          onFieldsLoaded={onFieldsLoaded}
        />
      </Collapse>
    </>
  );
}

export function SchemaExplorer({ datasourceId, onInsertText, onPreviewTable, onFieldsLoaded }: SchemaExplorerProps) {
  const { mappings, loading, error } = useMappings(datasourceId);
  const [filter, setFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!datasourceId) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Typography variant="body2">Select a datasource to explore schema</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          Loading tables...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          {error.message}
        </Typography>
      </Box>
    );
  }

  const filteredMappings = mappings.filter((m) =>
    m.mappingId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 0.75, borderBottom: `1px solid ${colors.border}` }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Filter tables..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.75rem',
              '& input': { py: '4px' },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }
          }}
        />
      </Box>
      <Box sx={{ flex: 1 }}>
        {filteredMappings.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, fontSize: '0.75rem' }}>
            No tables found
          </Typography>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={filteredMappings.length}
            defaultItemHeight={30}
            itemContent={(index) => {
              const mapping = filteredMappings[index];
              return (
                <MappingItem
                  key={mapping.id}
                  datasourceId={datasourceId}
                  mapping={mapping}
                  expanded={expandedIds.has(mapping.id)}
                  onToggle={() => toggleExpanded(mapping.id)}
                  onInsertText={onInsertText}
                  onPreviewTable={onPreviewTable}
                  onFieldsLoaded={onFieldsLoaded}
                />
              );
            }}
          />
        )}
      </Box>
    </Box>
  );
}
