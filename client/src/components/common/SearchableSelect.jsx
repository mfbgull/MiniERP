import { useState, useRef, useEffect } from 'react';
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
  const [filteredOptions, setFilteredOptions] = useState(options);
  const containerRef = useRef(null);

  // Filter options based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOptions(options);
    } else {
      setFilteredOptions(options.filter(option => filterOption(option, searchQuery)));
    }
  }, [searchQuery, options, filterOption]);

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
    setSearchQuery(event.target.value);
    setIsOpen(true);
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  // Update search query when value changes (for pre-selected values)
  useEffect(() => {
    const selectedOption = options.find(opt => opt.value === value);
    if (selectedOption) {
      setSearchQuery(selectedOption.label);
    } else {
      setSearchQuery('');
    }
  }, [value, options]);

  // Filter options to show available options
  const availableOptions = filteredOptions.filter(option => option.value !== value);

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
          placeholder={placeholder}
          disabled={disabled}
          className="searchable-select-input"
        />
        
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