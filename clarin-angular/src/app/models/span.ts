export interface Span {
  start:     number;
  end:       number;
  segment:   string;
  type?:     string;
  x?:        number;
  y?:        number;
  width?:    number;
  height?:   number;
  rotation?: number;
}
