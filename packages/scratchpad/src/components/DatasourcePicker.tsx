import { useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import {
  SiPostgresql,
  SiMysql,
  SiMariadb,
  SiSqlite,
  SiMongodb,
  SiElasticsearch,
  SiRedis,
  SiSnowflake,
  SiGooglebigquery,
  SiApachecassandra,
  SiCockroachlabs,
  SiFirebase,
  SiSupabase,
  SiClickhouse,
} from '@icons-pack/react-simple-icons';
import type { Datasource } from '../types';
import { colors } from '../theme';
import oracleIcon from '../assets/oracle-icon.svg';
import appIcon from '../assets/app-icon.svg';

const ICON_SIZE = 20;

// Custom badge for databases without Simple Icons
function DbBadge({ label, color, textColor = '#fff' }: { label: string; color: string; textColor?: string }) {
  return (
    <Box
      sx={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: 0.5,
        bgcolor: color,
        color: textColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {label}
    </Box>
  );
}

// Get icon for datasource type
function getDatasourceIcon(type: string) {
  const t = (type || '').toLowerCase();

  // PostgreSQL
  if (t.includes('postgres') || t.includes('pgsql')) {
    return <SiPostgresql size={ICON_SIZE} color="#4169E1" />;
  }
  // MySQL
  if (t.includes('mysql')) {
    return <SiMysql size={ICON_SIZE} color="#4479A1" />;
  }
  // MariaDB
  if (t.includes('maria')) {
    return <SiMariadb size={ICON_SIZE} color="#003545" />;
  }
  // SQL Server (no Simple Icon - use badge)
  if (t.includes('sqlserver') || t.includes('mssql') || t.includes('transact')) {
    return <DbBadge label="MS" color="#CC2927" />;
  }
  // Oracle
  if (t.includes('oracle')) {
    return <img src={oracleIcon} alt="Oracle" width={ICON_SIZE} height={ICON_SIZE} style={{ borderRadius: 3 }} />;
  }
  // SQLite
  if (t.includes('sqlite')) {
    return <SiSqlite size={ICON_SIZE} color="#003B57" />;
  }
  // MongoDB
  if (t.includes('mongo')) {
    return <SiMongodb size={ICON_SIZE} color="#47A248" />;
  }
  // Elasticsearch
  if (t.includes('elastic')) {
    return <SiElasticsearch size={ICON_SIZE} color="#005571" />;
  }
  // Redis
  if (t.includes('redis')) {
    return <SiRedis size={ICON_SIZE} color="#DC382D" />;
  }
  // Snowflake
  if (t.includes('snowflake')) {
    return <SiSnowflake size={ICON_SIZE} color="#29B5E8" />;
  }
  // BigQuery
  if (t.includes('bigquery')) {
    return <SiGooglebigquery size={ICON_SIZE} color="#669DF6" />;
  }
  // Redshift (no Simple Icon - use badge)
  if (t.includes('redshift')) {
    return <DbBadge label="RS" color="#8C4FFF" />;
  }
  // Cassandra
  if (t.includes('cassandra')) {
    return <SiApachecassandra size={ICON_SIZE} color="#1287B1" />;
  }
  // CockroachDB
  if (t.includes('cockroach')) {
    return <SiCockroachlabs size={ICON_SIZE} color="#6933FF" />;
  }
  // Firebase
  if (t.includes('firebase')) {
    return <SiFirebase size={ICON_SIZE} color="#FFCA28" />;
  }
  // Supabase
  if (t.includes('supabase')) {
    return <SiSupabase size={ICON_SIZE} color="#3FCF8E" />;
  }
  // ClickHouse
  if (t.includes('clickhouse')) {
    return <SiClickhouse size={ICON_SIZE} color="#FFCC01" />;
  }
  // App datasource
  if (t === 'app') {
    return <img src={appIcon} alt="App" width={ICON_SIZE} height={ICON_SIZE} />;
  }
  // Default
  return <StorageIcon sx={{ fontSize: ICON_SIZE, color: colors.textSecondary }} />;
}

interface DatasourcePickerProps {
  datasources: Datasource[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  loading: boolean;
  error: Error | null;
}

export function DatasourcePicker({
  datasources,
  selectedId,
  onChange,
  loading,
  error,
}: DatasourcePickerProps) {
  // Sort datasources alphabetically by name
  const sortedDatasources = useMemo(
    () =>
      datasources
        .filter((ds) => ds.type?.toLowerCase() !== 'informer')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [datasources]
  );

  const selectedDatasource = sortedDatasources.find((ds) => ds.id === selectedId) || null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading datasources...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error">
        Failed to load datasources: {error.message}
      </Typography>
    );
  }

  return (
    <Autocomplete
      size="small"
      sx={{ minWidth: 280 }}
      options={sortedDatasources}
      value={selectedDatasource}
      onChange={(_, newValue) => onChange(newValue?.id || null)}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search datasources..."
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5, mr: 0.5 }}>
                    {selectedDatasource ? getDatasourceIcon(selectedDatasource.type) : (
                      <StorageIcon sx={{ fontSize: ICON_SIZE, color: colors.textSecondary }} />
                    )}
                  </Box>
                  {params.InputProps.startAdornment}
                </>
              ),
            },
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box
            component="li"
            key={key}
            {...rest}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {getDatasourceIcon(option.type)}
            </Box>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" noWrap>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {option.typeName || option.type}
                {option.description && ` · ${option.description}`}
              </Typography>
            </Box>
          </Box>
        );
      }}
    />
  );
}
