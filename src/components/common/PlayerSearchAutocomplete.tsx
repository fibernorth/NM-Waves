import { useState, useMemo } from 'react';
import { Autocomplete, TextField, Box, Typography, Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { playersApi } from '@/lib/api/players';

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

  const { data: players = [] } = useQuery({
    queryKey: ['players', 'active'],
    queryFn: () => playersApi.getActive(),
  });

  const playerOptions: PlayerOption[] = useMemo(
    () =>
      players.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.firstName} ${p.lastName}`,
        teamName: p.teamName,
        teamId: p.teamId,
      })),
    [players]
  );

  const fuse = useMemo(
    () =>
      new Fuse(playerOptions, {
        keys: ['fullName', 'firstName', 'lastName'],
        threshold: 0.4,
        includeScore: true,
      }),
    [playerOptions]
  );

  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return playerOptions.slice(0, 20);
    return fuse.search(inputValue).slice(0, 10).map((r) => r.item);
  }, [inputValue, fuse, playerOptions]);

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
      noOptionsText="No players found"
    />
  );
};

export default PlayerSearchAutocomplete;
