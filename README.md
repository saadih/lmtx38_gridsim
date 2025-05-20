# Exjobbsarbete Grupp 20 
Grid collective Simulator

Gjort med React + TypeScript + Vite

## UML
# Component Architecture

Below is the UML class diagram for our React/TypeScript app:

```mermaid
classDiagram
    %% Component classes
    class App {
        +render()
    }
    class Home {
        -provider: "Ellevio" | "GE"
        -dataRows: EnergyData[]
        -showResult: boolean
        -isLoading: boolean
        -error: string | null
        +handleFileUpload(event: ChangeEvent)
        +handleReset()
        +render()
    }
    class Dropdown {
        +options: string[]
        +value: string
        +onChange(v: string)
        +render()
    }
    class Result {
        -isMaximized: boolean
        -strategy: ProviderStrategy
        -metrics: EnergyMetrics
        -tips: string[]
        +calculateChangePercentage(orig: number, opt: number): string
        +render()
    }
    class MetricCard {
        +title: string
        +value: ReactNode
        +description?: string
        +highlight?: boolean
        +changePercentage?: string
        +render()
    }

    %% Relationships
    App --> Home : contains
    Home --> Dropdown : uses
    Home --> Result : uses
    Result --> MetricCard : composes
