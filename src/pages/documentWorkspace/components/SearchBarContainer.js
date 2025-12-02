import React from 'react';
import SearchBar from './SearchBar';
import { useToolbarApi, useSearchApi } from '../context/DocumentWorkspaceContext';

const SearchBarContainer = ({ isVisible, onClose }) => {
  const {
    searchTerm,
    setSearchTerm,
  } = useToolbarApi();

  const {
    isSearching,
    results,
    activeIndex,
    goToNextResult,
    goToPreviousResult,
  } = useSearchApi();

  const totalResults = results?.length || 0;
  const activeResultNumber = totalResults && activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <SearchBar
      isVisible={isVisible}
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      isSearching={isSearching}
      totalResults={totalResults}
      activeResultNumber={activeResultNumber}
      onNextResult={goToNextResult}
      onPreviousResult={goToPreviousResult}
      onClose={onClose}
    />
  );
};

export default SearchBarContainer;

