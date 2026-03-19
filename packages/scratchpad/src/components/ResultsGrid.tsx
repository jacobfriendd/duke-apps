import { useMemo, useCallback, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, LicenseManager } from 'ag-grid-enterprise';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import type { ColDef, GridReadyEvent, GridApi, CellDoubleClickedEvent } from 'ag-grid-community';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DataObjectIcon from '@mui/icons-material/DataObject';
import type { QueryResult, QueryError } from '../types';
import { colors } from '../theme';

// Register AG Grid Enterprise
LicenseManager.setLicenseKey('Using_this_{AG_Grid}_Enterprise_key_{AG-060412}_in_excess_of_the_licence_granted_is_not_permitted___Please_report_misuse_to_legal@ag-grid.com___For_help_with_changing_this_key_please_contact_info@ag-grid.com___{Entrinsik,_Inc}_is_granted_a_{Single_Application}_Developer_License_for_the_application_{Informer}_only_for_{2}_Front-End_JavaScript_developers___All_Front-End_JavaScript_developers_working_on_{Informer}_need_to_be_licensed___{Informer}_has_been_granted_a_Deployment_License_Add-on_for_{1500}_Production_Environments___This_key_works_with_{AG_Grid}_Enterprise_versions_released_before_{5_August_2025}____[v3]_[01]_MTc1NDM0ODQwMDAwMA==69c5bf0ba7e64644ec18ef16b3fc4603');
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

interface ResultsGridProps {
  result: QueryResult | null;
  loading: boolean;
  error: QueryError | null;
}

interface JsonDialogState {
  open: boolean;
  title: string;
  value: unknown;
}

// Check if value is an object (but not null, Date, or Array shown as primitive)
function isJsonObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date)
  );
}

// Format value for display in cell
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (isJsonObject(value)) {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    const keys = Object.keys(value as object);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
  }
  return String(value);
}

export function ResultsGrid({ result, loading, error }: ResultsGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const apiRef = useRef<GridApi | null>(null);
  const [jsonDialog, setJsonDialog] = useState<JsonDialogState>({
    open: false,
    title: '',
    value: null,
  });

  // Generate column definitions from data
  const columnDefs = useMemo<ColDef[]>(() => {
    if (!result?.records?.length) return [];

    const firstRecord = result.records[0];
    const keys = Object.keys(firstRecord);

    return keys.map((key) => {
      const sampleValue = firstRecord[key];
      const isNumeric = typeof sampleValue === 'number';
      const isObject = isJsonObject(sampleValue);
      const isDate =
        sampleValue instanceof Date ||
        (typeof sampleValue === 'string' &&
          /^\d{4}-\d{2}-\d{2}/.test(sampleValue));

      const colDef: ColDef = {
        field: key,
        headerName: key,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 100,
      };

      if (isNumeric) {
        colDef.type = 'numericColumn';
        colDef.filter = 'agNumberColumnFilter';
        colDef.cellStyle = { textAlign: 'right' };
      } else if (isObject) {
        colDef.filter = false;
        colDef.valueFormatter = (params) => formatCellValue(params.value);
        colDef.cellStyle = {
          color: colors.accent,
          cursor: 'pointer',
          fontStyle: 'italic',
        };
      } else if (isDate) {
        colDef.filter = 'agDateColumnFilter';
      }

      return colDef;
    });
  }, [result]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 80,
    }),
    []
  );

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    apiRef.current = event.api;
    event.api.autoSizeAllColumns();
  }, []);

  const handleCellDoubleClick = useCallback((event: CellDoubleClickedEvent) => {
    const value = event.value;
    if (isJsonObject(value)) {
      setJsonDialog({
        open: true,
        title: event.colDef.headerName || event.colDef.field || 'Value',
        value,
      });
    }
  }, []);

  const handleCloseDialog = useCallback(() => {
    setJsonDialog((prev) => ({ ...prev, open: false }));
  }, []);

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
        }}
      >
        <CircularProgress size={32} sx={{ color: colors.accent }} />
        <Typography variant="body2" color="text.secondary">
          Executing query...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ fontFamily: 'monospace' }}>
          {error.message}
        </Alert>
      </Box>
    );
  }

  // Empty state
  if (!result) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 1.5,
            bgcolor: colors.surfaceHover,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TableChartOutlinedIcon sx={{ fontSize: 32, color: colors.textSecondary }} />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ color: 'text.primary', mb: 0.5 }}>
            No results yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Write a query and click Run to see results
          </Typography>
        </Box>
      </Box>
    );
  }

  // No records
  if (result.records.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Query returned no results
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${colors.border}`,
          bgcolor: colors.surfaceHover,
        }}
      >
        <Chip
          label={`${result.records.length.toLocaleString()} rows`}
          size="small"
          sx={{ fontSize: '0.75rem' }}
        />
        {result.truncated && (
          <Chip
            label="Results truncated"
            size="small"
            color="warning"
            sx={{ fontSize: '0.75rem' }}
          />
        )}
        <Chip
          label={`${columnDefs.length} columns`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.75rem' }}
        />
      </Box>

      {/* Grid */}
      <Box
        className="ag-theme-alpine"
        sx={{
          flex: 1,
          width: '100%',
          '& .ag-root-wrapper': {
            border: 'none',
          },
          '& .ag-header': {
            bgcolor: colors.surfaceHover,
          },
          '& .ag-header-cell': {
            fontWeight: 600,
            fontSize: '0.8125rem',
          },
          '& .ag-row': {
            fontSize: '0.8125rem',
          },
          '& .ag-cell': {
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
          },
        }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={result.records}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={handleGridReady}
          onCellDoubleClicked={handleCellDoubleClick}
          animateRows={true}
          pagination={true}
          paginationPageSize={100}
          paginationPageSizeSelector={[25, 50, 100, 500, 1000]}
          rowSelection="multiple"
          suppressRowClickSelection={true}
        />
      </Box>

      {/* JSON Viewer Dialog */}
      <Dialog
        open={jsonDialog.open}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: `1px solid ${colors.border}`,
            py: 1.5,
          }}
        >
          <DataObjectIcon sx={{ color: colors.accent }} />
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            {jsonDialog.title}
          </Typography>
          <IconButton size="small" onClick={handleCloseDialog}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: colors.surfaceHover,
              overflow: 'auto',
              maxHeight: '60vh',
              fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
            }}
          >
            {JSON.stringify(jsonDialog.value, null, 2)}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
