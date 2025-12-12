import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './SearchableSelect.css';

export default function SearchableSelect({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = "Search...",
  required = false,
  disabled = false,
  filterOption = (option, query) =>
    option.label.toLowerCase().includes(query.toLowerCase())
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  // Memoize the filter function to prevent recreating on every render
  const memoizedFilterOption = useCallback(
    (option, query) => filterOption(option, query),
    [filterOption]
  );

  // Filter options based on search query - use useMemo instead of useEffect
  const filteredOptions = useMemo(() => {
    if (searchQuery.trim() === '') {
      return options;
    }
    return options.filter(option => memoizedFilterOption(option, searchQuery));
  }, [searchQuery, options, memoizedFilterOption]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange({ target: { name, value: option.value } });
    setSearchQuery(option.label);
    setIsOpen(false);
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    // Open dropdown when user starts typing
    if (value.trim() !== '' && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen); // Toggle dropdown
    }
  };

  // Update search query when value changes (for pre-selected values)
  useEffect(() => {
    const selectedOption = options.find(opt => opt.value === value);
    if (selectedOption) {
      setSearchQuery(selectedOption.label);
    } else if (!value) {
      setSearchQuery('');
    }
  }, [value, options]);

  // Filter options to show available options
  const availableOptions = useMemo(() =>
    filteredOptions.filter(option => option.value !== value),
    [filteredOptions, value]
  );

  return (
    <div className="searchable-select-container" ref={containerRef}>
      <label className="form-label">
        {label}
        {required && <span className="required">*</span>}
      </label>

      <div className={`searchable-select ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}>
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onFocus={handleInputClick}
          placeholder={placeholder}
          disabled={disabled}
          className="searchable-select-input"
        />
        <div className="searchable-select-arrow">▼</div>

        <div className={`searchable-select-dropdown ${isOpen ? 'visible' : ''}`}>
          {availableOptions.length > 0 ? (
            availableOptions.map((option) => (
              <div
                key={option.value}
                className="searchable-select-option"
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="searchable-select-no-options">
              {searchQuery ? 'No options found' : 'Start typing to search...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}