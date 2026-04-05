export interface Store {
  id: number;
  brand_code: string;
  name: string;
  address: string;
  road_address: string;
  jibun_address: string;
  lat: number;
  lng: number;
  designation_date: string;
  expiration_date: string;
  license_type: string;
  tmX: number;
  tmY: number;
  is_geocoded: number;
}

export interface TobaccoShop {
  id: number;
  name: string;
  address: string;
  road_address: string;
  jibun_address: string;
  designation_date: string;
  expiration_date: string;
  license_type: string;
  lat: number;
  lng: number;
  tmX: number;
  tmY: number;
  is_geocoded: number;
}

export interface TargetPoint {
  id: number;
  name: string;
  address: string;
  area_size: number;
  rent_fee: number;
  memo: string;
  lat: number;
  lng: number;
}

export interface SelectedEntity {
  type: 'store' | 'tobacco' | 'target' | 'location';
  data: any;
}
