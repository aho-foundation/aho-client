const lines = (code) => {
  if (!code) return [];
  return code.split('\n').map((line, index) => ({
    number: index + 1,
    content: line
  }));
}; 