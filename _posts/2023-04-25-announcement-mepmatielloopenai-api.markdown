---
layout: post
title:  "Announcement: me.pmatiello/openai-api"
date:   2023-04-25 22:30:00
categories: clojure openai api
---

`me.pmatiello/openai-api` is a pure-Clojure wrapper around the [OpenAI API](https://platform.openai.com/), offering various functions for interacting with the API's capabilities. These include text generation, image generation and editing, embeddings, audio transcription and translation, file management, fine-tuning, and content moderation.

{% highlight clojure %}
(require '[me.pmatiello.openai-api.api :as openai])

(def credentials
  (openai/credentials api-key))

(openai/chat {:model    "gpt-3.5-turbo"
              :messages [{:role    "user"
                          :content "Fix: (println \"hello"}]}
             credentials)
{% endhighlight %}

**Notice:** This is not an official OpenAI project nor is it affiliated with OpenAI in any way.

Refer to the [project page](https://github.com/pmatiello/openai-api) and [documentation](https://cljdoc.org/d/me.pmatiello/openai-api/) for more.