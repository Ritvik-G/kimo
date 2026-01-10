export type MappingRow = {
  id: string;
  input: string;
  output: string;
  metrics: string[];
  owner: string;
  threshold: string;
  cadence: string;
};

export type CategoryStyle = {
  dot: string;
  chip: string;
  selected: string;
  idle: string;
};
