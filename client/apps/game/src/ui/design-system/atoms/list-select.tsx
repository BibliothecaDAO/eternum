import { ReactComponent as CaretDown } from "@/assets/icons/common/caret-down-fill.svg";
import { ReactComponent as Checkmark } from "@/assets/icons/common/checkmark.svg";
import TextInput from "@/ui/design-system/atoms/text-input";
import { Listbox, Transition } from "@headlessui/react";
import clsx from "clsx";
import { Fragment, ReactNode, useMemo, useRef, useState } from "react";

interface ListSelectOption {
  id: any;
  label: ReactNode;
  searchText?: string;
}

type ListSelectProps = {
  title?: string;
  options: ListSelectOption[];
  value: any;
  onChange: (value: any) => void;
  className?: string;
  style?: "default" | "black";
  enableFilter?: boolean;
};

function ListSelect(props: ListSelectProps) {
  const [searchInput, setSearchInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () =>
      props.options.find((option) => option.id === props.value) ||
      props.options[0] || { id: "", label: "Select a wallet..." },
    [props.value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchInput || !props.enableFilter) return props.options;

    return props.options.filter((option) => {
      const searchText = option.searchText || (typeof option.label === "string" ? option.label : "");
      return searchText.toLowerCase().includes(searchInput.toLowerCase());
    });
  }, [props.options, searchInput, props.enableFilter]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (filteredOptions.length > 0) {
        props.onChange(filteredOptions[0].id);
        setSearchInput("");
      }
    } else {
      e.stopPropagation();
    }
  };

  return (
    <div className={clsx("w-full", props.className, "z-100")}>
      <Listbox value={props.value} onChange={props.onChange}>
        {({ open }) => (
          <div className="relative">
            <Listbox.Button
              className={clsx(
                "flex items-center relative  cursor-pointer text-xs py-1 min-h-[32px] z-0 w-full bg-gold/10  hover:bg-gold/20 px-2",
              )}
            >
              {props.title && <span className="truncate flex items-center !text-gold mr-2">{props.title}</span>}
              <span className="truncate flex items-center">{selectedOption.label}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <div className="flex flex-col items-center justify-center ml-1">
                  <CaretDown
                    className={clsx("stroke-gold fill-gold transition-transform duration-100", open && "rotate-180")}
                  />
                </div>
              </span>
            </Listbox.Button>
            <Transition
              as={Fragment}
              show={open}
              appear
              enter="transition ease-out duration-100"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="absolute top-[100%] z-50 w-full text-xs">
                <Listbox.Options
                  className={clsx(
                    "mt-2 w-full rounded-md py-1 max-h-72 overflow-scroll z-100 border border-gold/10 no-scrollbar",
                    props.style === "black" ? "bg-brown" : " bg-brown",
                  )}
                >
                  {props.enableFilter && (
                    <div className="p-2">
                      <TextInput
                        ref={inputRef}
                        onChange={setSearchInput}
                        placeholder="Filter..."
                        onKeyDown={handleKeyDown}
                        className="w-full"
                      />
                    </div>
                  )}

                  {filteredOptions.map((option) => (
                    <Listbox.Option
                      key={option.id}
                      className={({ active }) =>
                        `overflow-visible relative cursor-pointer z-50 select-none py-2 flex items-center pl-8 text-gold ${
                          active ? "bg-gold/10 text-white/90" : ""
                        }`
                      }
                      value={option.id}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`z-50 flex items-center  truncate ${
                              selected ? "font-bold text-white" : "font-normal"
                            }`}
                          >
                            {option.label}
                          </span>
                          {selected ? (
                            <span className="z-50 absolute inset-y-0 left-0 flex items-center pl-3">
                              <Checkmark className="h-3 w-3 fill-gold " aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Transition>
          </div>
        )}
      </Listbox>
    </div>
  );
}

export default ListSelect;
