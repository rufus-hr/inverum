/// <reference types="vite/client" />

declare namespace React {
  interface Attributes {
    key?: string | number | bigint | null | undefined;
  }
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | bigint | null | undefined;
    }
  }
}

declare namespace JSX {
  interface IntrinsicAttributes {
    key?: string | number | bigint | null | undefined;
  }
}
