import { useState, useMemo } from 'react';
import { Autocomplete, TextField, Box, Typography, Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { searchLinkablePlayers } from '@/lib/api/parentActions';

interface PlayerOption {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  teamName?: string;
  teamId?: string;
}

interface PlayerSearchAutocompleteProps {
  onSelect: (player: PlayerOption | null) => void;
  label?: string;
  placeholder?: string;
  value?: PlayerOption | null;
  disabled?: boolean;
}

const PlayerSearchAutocomplete = ({
  onSelect,
  label = 'Search Player',
  placeholder = 'Type a player name...',
  value = null,
  disabled = false,
}: PlayerSearchAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');

  // Search via Cloud Function (sanitized, safe fields only). The players
  // collection is not directly readable by non-coach roles, so this replaces
  // the previous full-roster load + client-side fuzzy search.
  const { data: results = [] } = useQuery({
    queryKey: ['linkablePlayers', inputValue],
    queryFn: () => searchLinkablePlayers(inputValue),
    enabled: inputValue.trim().length >= 2,
  });

  const filteredOptions: PlayerOption[] = useMemo(
    () =>
      results.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.firstName} ${p.lastName}`,
        teamName: p.teamName,
      })),
    [results]
  );

  return (
    <Autocomplete
      options={filteredOptions}
      getOptionLabel={(option) => option.fullName}
      value={value}
      onChange={(_, newValue) => onSelect(newValue)}
      inputValue={inputValue}
      onInputChange={(_, newInput) => setInputValue(newInput)}
      disabled={disabled}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box>
            <Typography variant="body1">{option.fullName}</Typography>
            {option.teamName && (
              <Chip label={option.teamName} size="small" color="primary" variant="outlined" sx={{ ml: 1 }} />
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} fullWidth />
      )}
      noOptionsText={inputValue.trim().length < 2 ? 'Type at least 2 characters…' : 'No players found'}
    />
  );
};

export default PlayerSearchAutocomplete;
