export function getMinimalTextChange(currentText, nextText) {
  let prefixLength = 0;
  const maxPrefixLength = Math.min(currentText.length, nextText.length);
  while (
    prefixLength < maxPrefixLength &&
    currentText.charCodeAt(prefixLength) === nextText.charCodeAt(prefixLength)
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maxSuffixLength = Math.min(
    currentText.length - prefixLength,
    nextText.length - prefixLength,
  );
  while (
    suffixLength < maxSuffixLength &&
    currentText.charCodeAt(currentText.length - suffixLength - 1) ===
      nextText.charCodeAt(nextText.length - suffixLength - 1)
  ) {
    suffixLength += 1;
  }

  return {
    from: prefixLength,
    to: currentText.length - suffixLength,
    insert: nextText.slice(prefixLength, nextText.length - suffixLength),
  };
}

export function mapPositionThroughTextChange(
  position,
  change,
  oldLength,
  newLength,
) {
  const clampedPosition = Math.max(0, Math.min(position, oldLength));
  if (change.from === 0 && change.to === oldLength) {
    return Math.min(clampedPosition, newLength);
  }
  if (clampedPosition <= change.from) {
    return clampedPosition;
  }
  if (clampedPosition >= change.to) {
    return Math.max(
      0,
      Math.min(
        clampedPosition + change.insert.length - (change.to - change.from),
        newLength,
      ),
    );
  }
  return Math.min(change.from + change.insert.length, newLength);
}
