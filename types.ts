export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationUpdate extends Coordinates {
  id: string;
  name?: string;
  email?: string;
}
